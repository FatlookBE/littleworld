import { describe, it, expect } from "vitest";
import {
  createWorld,
  step,
  stage,
  residents,
  intervene,
  catchUp,
  newSession,
  syncDay,
} from "./engine";
import { findRoute, walkable } from "./navigation";
import {
  ingest,
  totals,
  CodexAdapter,
  ReplayAdapter,
  validateEvent,
} from "./telemetry";
import { restore } from "./persistence";
import type { UsageEvent } from "./types";
const usage = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
  id: "one",
  session: "s",
  at: "2026-11-18T10:00:00.000Z",
  origin: "test",
  provenance: "measured",
  input: 700,
  output: 300,
  ...overrides,
});
const ticks = (w: ReturnType<typeof createWorld>, n: number) => {
  for (let i = 0; i < n; i++) step(w);
};
describe("usage accounting", () => {
  it("deduplicates, completes partial records and handles out-of-order records", () => {
    const w = createWorld();
    ingest(w, usage());
    ingest(w, usage());
    ingest(w, usage({ input: 900 }));
    ingest(w, usage({ input: 500 }));
    ingest(w, usage({ id: "two", at: "2026-11-17T09:00:00Z" }));
    expect(totals(w).input).toBe(1600);
    expect(totals(w).output).toBe(600);
    expect(w.usage).toHaveLength(2);
  });
  it("does not add cached or reasoning subcategories to the total", () => {
    const w = createWorld();
    ingest(w, usage({ cached: 500, reasoning: 100 }));
    const t = totals(w);
    expect(t.input + t.output).toBe(1000);
    expect(t.cached).toBe(500);
  });
  it("uses explicit date and session boundaries", () => {
    const w = createWorld(Date.parse("2026-11-18T12:00:00Z"));
    w.session = "s";
    ingest(w, usage());
    ingest(w, usage({ id: "old", session: "old", at: "2026-11-17T12:00:00Z" }));
    expect(totals(w, "day").input).toBe(700);
    expect(totals(w, "session").input).toBe(700);
    expect(totals(w).input).toBe(1400);
  });
  it("rejects invalid counts, contradictory provenance and drops extra data", () => {
    expect(() => validateEvent(usage({ input: -1 }))).toThrow();
    expect(() => validateEvent(usage({ cached: 701 }))).toThrow();
    expect(validateEvent({ ...usage(), prompt: "secret" })).not.toHaveProperty(
      "prompt",
    );
    const w = createWorld();
    ingest(w, usage());
    expect(() => ingest(w, usage({ provenance: "demo" }))).toThrow();
  });
  it("only imports completed Codex turns, preserving stable IDs across repeated imports", () => {
    const text = [
      { type: "thread.started", thread_id: "thread-1" },
      { type: "item.completed", usage: { input_tokens: 999 } },
      {
        type: "turn.completed",
        usage: {
          input_tokens: 100,
          cached_input_tokens: 30,
          output_tokens: 20,
          reasoning_output_tokens: 5,
        },
      },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n");
    const adapter = new CodexAdapter();
    const w = createWorld();
    for (const e of adapter.read(text)) ingest(w, e);
    for (const e of adapter.read(text)) ingest(w, e);
    expect(totals(w).input).toBe(100);
    expect(totals(w, "day").input).toBe(0);
    expect(w.usage[0].at).toContain("1970");
    expect(() =>
      adapter.read(JSON.stringify({ type: "turn.completed", usage: {} })),
    ).toThrow();
  });
  it("requires an array for normalized replay and validates every event", () => {
    expect(() => new ReplayAdapter().read("{}")).toThrow();
    expect(new ReplayAdapter().read(JSON.stringify([usage()]))).toHaveLength(1);
  });
});
describe("simulation", () => {
  it("keeps isolated inhabitants safe and clears replay on a fresh session", () => {
    const w = createWorld(0);
    w.villagers[0].ties = [];
    ticks(w, 300);
    expect(w.villagers[0].health).toBeGreaterThan(80);
    w.settings.scenario = "session";
    w.replay = {
      events: [usage()],
      cursor: 0,
      startedTick: w.tick,
      firstAt: Date.parse(usage().at),
    };
    newSession(w, 10000);
    expect(w.replay).toBeUndefined();
    ticks(w, 30);
    expect(w.usage).toHaveLength(0);
  });
  it("the paced demo reaches every milestone and leaves personal stories of scarcity", () => {
    const w = createWorld(0);
    w.replayOn = true;
    let lowestFood = w.food;
    for (let i = 0; i < 3000; i++) {
      step(w);
      lowestFood = Math.min(lowestFood, w.food);
    }
    expect(w.milestones).toEqual([0, 1, 2, 3, 4, 5]);
    expect(w.water).toBeLessThan(20);
    // Reserves may rebound after deaths reduce consumption. Verify the shortage occurred.
    expect(lowestFood).toBeLessThan(20);
    expect(residents(w).length).toBeLessThan(24);
    expect(
      w.villagers.some((v) => v.memories.some((m) => m.kind === "warning")),
    ).toBe(true);
  });
  it("updates the daily window across UTC midnight while open", () => {
    const w = createWorld(Date.parse("2026-11-18T23:59:59Z"));
    w.settings.scenario = "daily";
    ingest(w, usage());
    expect(totals(w, "day").input).toBe(700);
    syncDay(w, Date.parse("2026-11-19T00:00:01Z"));
    expect(totals(w, "day").input).toBe(0);
  });
  it("stays at a well long enough to drink and remains healthy without usage", () => {
    const w = createWorld(0);
    const v = w.villagers[0];
    v.x = 13.5;
    v.y = 14.5;
    v.target = [13.5, 14.5];
    v.route = [];
    v.action = "Attend son tour au puits";
    v.nextDecision = 100;
    v.thirst = 70;
    const before = v.x;
    ticks(w, 20);
    expect(v.x).toBe(before);
    expect(v.thirst).toBeLessThan(35);
    ticks(w, 5000);
    expect(residents(w)).toHaveLength(24);
    expect(w.water).toBeGreaterThan(50);
    expect(w.food).toBeGreaterThan(50);
    expect(w.villagers.every((v) => v.health > 80)).toBe(true);
  });
  it("routes around solid buildings and crosses the river at the bridge", () => {
    const w = createWorld(0),
      route = findRoute(w, [2.5, 10.5], [20.5, 21.5]);
    expect(route.length).toBeGreaterThan(2);
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1],
        b = route[i];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      for (let n = 0; n <= d; n++) {
        const x = a[0] + ((b[0] - a[0]) * n) / d,
          y = a[1] + ((b[1] - a[1]) * n) / d;
        expect(walkable(w, Math.floor(x), Math.floor(y))).toBe(true);
      }
    }
  });
  it("plays timestamped imports with original intervals and survives offline catch-up", () => {
    const w = createWorld(0),
      events = [
        usage(),
        usage({ id: "later", at: "2026-11-18T10:00:02.000Z" }),
      ];
    w.replay = {
      events,
      cursor: 0,
      startedTick: 0,
      firstAt: Date.parse(events[0].at),
    };
    step(w);
    expect(w.usage).toHaveLength(1);
    ticks(w, 8);
    expect(w.usage).toHaveLength(1);
    const copy = restore(JSON.stringify(w));
    catchUp(copy, 86400000);
    expect(copy.usage).toHaveLength(1);
    step(copy);
    expect(copy.usage).toHaveLength(2);
    expect(copy.replay).toBeUndefined();
  });
  it("rejects corrupted saves before use", () => {
    const cases = [
      (w: ReturnType<typeof createWorld>) => {
        w.settings.thresholds = undefined!;
      },
      (w: ReturnType<typeof createWorld>) => {
        w.villagers[0].ties[0].id = 999;
      },
      (w: ReturnType<typeof createWorld>) => {
        w.villagers[0].thirst = NaN;
      },
      (w: ReturnType<typeof createWorld>) => {
        w.buildings[0].events.push({
          tick: 0,
          text: "bad",
          kind: "hope",
          person: 40,
        });
      },
    ];
    for (const mutate of cases) {
      const w = createWorld(0);
      mutate(w);
      expect(() => restore(JSON.stringify(w))).toThrow();
    }
  });
  it("is deterministic and keeps resource balances bounded", () => {
    const a = createWorld(0),
      b = createWorld(0);
    a.replayOn = b.replayOn = true;
    ticks(a, 3000);
    ticks(b, 3000);
    expect(a).toEqual(b);
    for (const v of [a.water, a.food, a.pressure, a.fertility, a.cooperation]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    console.log(
      "demo at 3000 ticks",
      a.pressure,
      a.water,
      a.food,
      residents(a).length,
      a.chronicle.length,
    );
  });
  it("changes environment continuously and respects editable thresholds", () => {
    const w = createWorld();
    ingest(w, usage({ input: 100000, output: 0 }));
    step(w);
    expect(w.pressure).toBeGreaterThan(0);
    expect(w.pressure).toBeLessThan(2);
    w.settings.thresholds = [5, 10, 20, 40, 80];
    w.pressure = 21;
    expect(stage(w)).toBe(3);
  });
  it("pressure reduces production, crop health and water compared with control", () => {
    const healthy = createWorld(0),
      dry = createWorld(0);
    healthy.settings.adaptive = dry.settings.adaptive = false;
    ingest(dry, usage({ input: 100000, output: 0 }));
    ticks(healthy, 1200);
    ticks(dry, 1200);
    expect(dry.moisture).toBeLessThan(healthy.moisture);
    expect(dry.water).toBeLessThan(healthy.water);
    expect(dry.food).toBeLessThan(healthy.food);
  });
  it("remembers social encounters based on actual scarcity and proximity", () => {
    const w = createWorld(0);
    w.water = 20;
    for (const v of w.villagers) {
      v.x = 13;
      v.y = 14;
      v.route = [];
      v.cooldown = 0;
      v.thirst = v.id % 2 ? 80 : 20;
      v.ties = [{ id: (v.id + 1) % 24, bond: 90, favors: 0 }];
    }
    ticks(w, 100);
    expect(w.chronicle.some((e) => e.text.includes("partage sa gourde"))).toBe(
      true,
    );
    expect(w.villagers.some((v) => v.ties.some((t) => t.favors > 0))).toBe(
      true,
    );
  });
  it("dies when health is exhausted under scarcity, preserves people and their history", () => {
    const w = createWorld(0);
    w.settings.adaptive = false;
    w.water = 0;
    w.food = 0;
    w.pressure = 100;
    ingest(w, usage({ input: 1000000 }));
    for (const v of w.villagers) {
      v.morale = 0;
      v.health = 20;
      v.cooldown = 0;
      v.resilience = 0;
    }
    ticks(w, 1000);
    expect(residents(w).length).toBeLessThan(24);
    expect(w.villagers).toHaveLength(24);
    expect(
      w.villagers
        .find((v) => v.dead)
        ?.memories.some((e) => e.text.includes("s’effondre")),
    ).toBe(true);
  });
  it("recovers with inactivity and deliberate cooperation even far beyond budget", () => {
    const w = createWorld(0);
    w.settings.adaptive = false;
    ingest(w, usage({ input: 1000000 }));
    ticks(w, 500);
    const pressure = w.pressure;
    intervene(w);
    ticks(w, 2500);
    expect(w.pressure).toBeLessThan(pressure - 20);
  });
  it("restores full relationships and stories and bounds offline catch-up without demo tokens", () => {
    const w = createWorld(0);
    w.replayOn = true;
    ticks(w, 250);
    const copy = restore(JSON.stringify(w));
    expect(copy).toEqual(w);
    const before = copy.tick,
      count = copy.usage.length;
    catchUp(copy, 864000000);
    expect(copy.tick - before).toBe(300);
    expect(copy.usage.length).toBe(count);
    expect(copy.replayOn).toBe(true);
  });
  it("fresh session stores a snapshot and keeps historical telemetry", () => {
    const w = createWorld(0);
    w.settings.scenario = "session";
    ingest(w, usage());
    ticks(w, 20);
    newSession(w, 10000);
    expect(w.tick).toBe(0);
    expect(w.snapshots).toHaveLength(1);
    expect(w.usage).toHaveLength(1);
    expect(totals(w, "session").input).toBe(0);
  });
});
