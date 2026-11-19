import { expect, it } from "vitest";
import { createWorld } from "./engine";
import {
  dailyFresh,
  effectiveBudget,
  selectedUsage,
  syncUsage,
  totals,
  usageSessionKey,
} from "./telemetry";
import { restore } from "./persistence";
import type { UsageEvent } from "./types";
const event = (session: string, project?: string): UsageEvent => ({
  id: session,
  session,
  project,
  origin: "test",
  provenance: "measured",
  at: "2026-11-18T12:00:00.000Z",
  input: 100,
  output: 20,
  cached: 30,
});
it("filters day, lifetime totals and adaptive budget while retaining all imported data", () => {
  const w = createWorld(Date.parse("2026-11-19T12:00:00Z"));
  syncUsage(
    w,
    [event("a", "/project/a"), event("b", "/project/b"), event("c")],
    true,
  );
  w.settings.usageProject = "/project/a";
  expect(selectedUsage(w)).toHaveLength(1);
  expect(dailyFresh(w).get("2026-11-18")).toBe(90);
  expect(totals(w)).toMatchObject({ input: 100, output: 20, cached: 30 });
  expect(effectiveBudget(w)).toBe(10000);
  expect(w.usage).toHaveLength(3);
  w.settings.usageProject = "__unknown__";
  expect(selectedUsage(w)[0].session).toBe("c");
});
it("excludes other sessions from immediate pressure and retains scope on save/restore", () => {
  const w = createWorld(1);
  w.settings.usageSession = usageSessionKey(event("a"));
  w.relief = 70;
  syncUsage(w, [event("b", "/project/b")], false);
  expect(w.relief).toBe(70);
  syncUsage(w, [event("a", "/project/a")], false);
  expect(w.relief).toBeLessThan(70);
  const saved = restore(JSON.stringify(w));
  expect(saved.settings.usageSession).toBe(w.settings.usageSession);
  expect(saved.usage[0].project).toBe("/project/b");
});
it("enriches known counters with project metadata without charging tokens again", () => {
  const w = createWorld(1);
  syncUsage(w, [event("a")], true);
  w.relief = 75;
  expect(syncUsage(w, [event("a", "/project/a")], false)).toBe(1);
  expect(w.relief).toBe(75);
  expect(w.usage[0].project).toBe("/project/a");
});

it("does not turn metadata enrichment during migration into historical pressure", () => {
  const w = createWorld(1);
  syncUsage(w, [{ ...event("s"), origin: "codex" }], true);
  w.settings.usageProject = "/project/a";
  w.relief = 70;
  syncUsage(
    w,
    [
      {
        ...event("s", "/project/a"),
        origin: "codex",
        id: "codex-day:s:2026-11-18",
        at: "2026-11-18T00:00:00.000Z",
      },
    ],
    false,
    ["s"],
  );
  expect(w.relief).toBe(70);
  expect(selectedUsage(w)).toHaveLength(1);
});

it("uses the selected external conversation in fixed session mode", () => {
  const w = createWorld(1);
  w.settings.scenario = "session";
  w.settings.adaptive = false;
  syncUsage(w, [event("external-a"), event("external-b")], true);
  w.settings.usageSession = usageSessionKey(event("external-a"));
  expect(totals(w, "session")).toMatchObject({ input: 100, output: 20 });
});
