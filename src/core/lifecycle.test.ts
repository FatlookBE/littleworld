import { expect, it } from "vitest";
import { createWorld, residents, step, intervene } from "./engine";
import { remainsStage } from "./lifecycle";
import { restore } from "./persistence";
it("death stops a villager in place, excludes needs and never revives during recovery", () => {
  const w = createWorld(0),
    v = w.villagers[0];
  v.health = 0;
  const position = [v.x, v.y];
  step(w);
  expect(v.dead).toBe(true);
  expect([v.x, v.y]).toEqual(position);
  expect(v.route).toEqual([]);
  expect(residents(w)).not.toContain(v);
  const needs = [v.hunger, v.thirst, v.energy];
  for (let i = 0; i < 250; i++) step(w);
  intervene(w);
  expect([v.x, v.y]).toEqual(position);
  expect([v.hunger, v.thirst, v.energy]).toEqual(needs);
  expect(v.health).toBe(0);
  expect(v.dead).toBe(true);
  expect(v.memories.filter((m) => m.text.includes("s’effondre"))).toHaveLength(
    1,
  );
  expect(remainsStage(v, w.tick)).toBe(3);
  const saved = restore(JSON.stringify(w));
  expect(saved.villagers[0]).toEqual(v);
});
it("remains progress only with simulation ticks and retain the skeleton forever", () => {
  const w = createWorld(0),
    v = w.villagers[0];
  v.health = 0;
  step(w);
  expect(remainsStage(v, w.tick)).toBe(0);
  expect(remainsStage(v, v.diedAt! + 5)).toBe(1);
  expect(remainsStage(v, v.diedAt! + 90)).toBe(2);
  expect(remainsStage(v, v.diedAt! + 210)).toBe(3);
  expect(remainsStage(v, v.diedAt! + 100000)).toBe(3);
});
it("migrates legacy departed villagers at their saved location and rejects invalid death state", () => {
  const legacy = JSON.parse(JSON.stringify(createWorld(0)));
  legacy.tick = 100;
  for (const v of legacy.villagers) {
    v.departed = false;
    delete v.dead;
  }
  legacy.villagers[0].departed = true;
  legacy.villagers[0].departedAt = 30;
  const restored = restore(JSON.stringify(legacy));
  const v = restored.villagers[0];
  expect(v.dead).toBe(true);
  expect(v.diedAt).toBe(30);
  expect(v.health).toBe(0);
  expect(v.x).toBe(legacy.villagers[0].x);
  expect(v.route).toEqual([]);
  expect("departed" in v).toBe(false);
  v.diedAt = 101;
  expect(() => restore(JSON.stringify(restored))).toThrow();
  v.diedAt = 30;
  v.health = 1;
  expect(() => restore(JSON.stringify(restored))).toThrow();
});
it("a lethal monster impact causes death in the same tick", () => {
  const w = createWorld(0);
  const v = w.villagers[0];
  v.x = 13;
  v.y = 15;
  v.route = [];
  v.target = [13, 15];
  v.nextDecision = 100;
  v.health = 1;
  w.tick = 4;
  w.disasters = [
    { kind: "monster", x: 12, y: 15, people: [v.id], attackAt: 1, life: 100 },
  ];
  step(w);
  expect(v.dead).toBe(true);
  expect(v.diedAt).toBe(5);
  expect(v.health).toBe(0);
});
