import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import { ingest } from "./telemetry";
import { bridgeRows, riverCenter, walkable, findRoute } from "./navigation";
import { buildingDamageStage } from "../environment";
it("all three visible bridges cross the river and routes reach both banks", () => {
  const w = createWorld(0);
  for (const y of bridgeRows) {
    expect(walkable(w, Math.floor(riverCenter(y + 0.5)), y)).toBe(true);
    const path = findRoute(w, [0.5, y + 0.5], [10.5, y + 0.5]);
    expect(path.at(-1)?.[0]).toBeGreaterThan(8);
  }
});
it("living villagers actually visit the four outskirts in a healthy world", () => {
  const w = createWorld(0);
  const visited = new Set<string>();
  for (let i = 0; i < 3500; i++) {
    step(w);
    for (const v of w.villagers) {
      if (v.dead) continue;
      if (v.x < 3) visited.add("west");
      if (v.x > 25) visited.add("east");
      if (v.y < 3) visited.add("north");
      if (v.y > 25) visited.add("south");
    }
  }
  expect([...visited].sort()).toEqual(["east", "north", "south", "west"]);
  expect(w.villagers.every((v) => !v.dead)).toBe(true);
});
it("sustained high pressure visibly passes through every building degradation stage", () => {
  const w = createWorld(0);
  ingest(w, {
    id: "decay",
    session: w.session,
    at: new Date(0).toISOString(),
    origin: "test",
    provenance: "demo",
    input: 1000000,
    output: 0,
  });
  const seen = new Set<number>();
  for (let i = 0; i < 1100; i++) {
    w.lastUsageTick = w.tick;
    step(w);
    seen.add(buildingDamageStage(w.buildings[0].condition));
  }
  expect([...seen]).toEqual([0, 1, 2, 3]);
  expect(w.buildings[0].condition).toBeGreaterThanOrEqual(0);
});
