import { expect, it } from "vitest";
import { createWorld } from "./engine";
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
