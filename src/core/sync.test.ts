import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import { syncUsage } from "./telemetry";
import type { UsageEvent } from "./types";

const ev = (id: string, out: number): UsageEvent => ({
  id,
  session: "s",
  at: "2026-11-18T10:00:00.000Z",
  origin: "codex",
  provenance: "measured",
  input: 1000,
  output: out,
});

it("baseline keeps totals without draining relief, later growth does", () => {
  const w = createWorld(1);
  w.relief = 80;
  expect(syncUsage(w, [ev("a", 100)], true)).toBe(1);
  expect(w.usage).toHaveLength(1);
  expect(w.relief).toBe(80);
  expect(syncUsage(w, [ev("a", 100)], false)).toBe(0);
  expect(syncUsage(w, [ev("a", 600), ev("b", 5)], false)).toBe(2);
  expect(w.relief).toBeLessThan(80);
  expect(w.usage).toHaveLength(2);
});

import { effectiveBudget, dailyFresh } from "./telemetry";
it("adaptive budget is twice the mean of past days, cache excluded", () => {
  const w = createWorld(Date.parse("2026-11-18T12:00:00Z"));
  expect(effectiveBudget(w)).toBe(w.settings.budget);
  const day = (d: string, id: string, input: number, cached: number) =>
    ({ ...ev(id, 0), at: `${d}T10:00:00.000Z`, input, cached }) as UsageEvent;
  syncUsage(
    w,
    [
      day("2026-11-16", "a", 60000, 10000),
      day("2026-11-17", "b", 40000, 0),
      day("2026-11-18", "c", 999999, 0),
    ],
    true,
  );
  expect(dailyFresh(w).get("2026-11-16")).toBe(50000);
  expect(effectiveBudget(w)).toBe(90000);
});

it("keeps daily usage above the adaptive budget visible after full recovery", () => {
  const w = createWorld(Date.parse("2026-11-18T12:00:00Z"));
  syncUsage(
    w,
    [
      { ...ev("yesterday", 0), at: "2026-11-17T12:00:00Z", input: 750000 },
      { ...ev("today", 0), input: 2500000 },
    ],
    true,
  );
  w.relief = 100;
  step(w);
  expect(w.budgetNow).toBe(1500000);
  expect(w.pressure).toBeCloseTo((2500000 / 1500000 - 1) * 100 * 0.012);
});

it("replaces a legacy session with daily totals without double counting or historical penalty", () => {
  const w = createWorld(1);
  const legacy = { ...ev("s", 30), session: "s", input: 200 };
  syncUsage(w, [legacy], true);
  w.relief = 70;
  const days = [
    {
      ...legacy,
      id: "codex-day:s:2026-11-18",
      at: "2026-11-18T00:00:00.000Z",
      input: 80,
      output: 10,
    },
    {
      ...legacy,
      id: "codex-day:s:2026-11-19",
      at: "2026-11-19T00:00:00.000Z",
      input: 120,
      output: 20,
    },
  ];
  expect(syncUsage(w, days, false, ["s"])).toBeGreaterThan(0);
  expect(w.usage).toHaveLength(2);
  expect(w.relief).toBe(70);
  expect(dailyFresh(w).get("2026-11-19")).toBe(140);
  expect(syncUsage(w, days, false, ["s"])).toBe(0);
  expect(w.relief).toBe(70);
  syncUsage(w, [{ ...days[1], output: 30 }], false, ["s"]);
  expect(w.relief).toBeLessThan(70);
});
it("keeps legacy data intact when replacement history is incomplete or malformed", () => {
  const w = createWorld(1);
  syncUsage(w, [{ ...ev("s", 100), session: "s" }], true);
  const before = structuredClone(w.usage);
  syncUsage(
    w,
    [{ ...ev("codex-day:s:2026-11-18", 2), session: "s", input: 10 }],
    false,
    ["s"],
  );
  expect(w.usage).toEqual(before);
});

it("does not mix partial daily observations with an unmigrated legacy session", () => {
  const w = createWorld(1);
  syncUsage(w, [{ ...ev("s", 100), session: "s" }], true);
  const before = structuredClone(w.usage);
  syncUsage(
    w,
    [
      {
        ...ev("codex-day:s:2026-11-19", 5),
        input: 40,
        session: "s",
        at: "2026-11-19T00:00:00.000Z",
      },
    ],
    false,
    [],
  );
  expect(w.usage).toEqual(before);
});
