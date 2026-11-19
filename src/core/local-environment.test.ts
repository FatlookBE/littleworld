import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import { restore } from "./persistence";
import {
  buildingWear,
  ensureLocalEnvironment,
  plotPosition,
  treePosition,
  updateLocalEnvironment,
} from "./local-environment";

it("drying differs by location and remains bounded across a long drought", () => {
  const w = createWorld(1);
  w.moisture = 15;
  w.water = 70;
  w.pressure = 65;
  for (let i = 0; i < 600; i++) updateLocalEnvironment(w);
  const local = ensureLocalEnvironment(w);
  const health = local.plots.map((p) => p.health);
  expect(Math.max(...health) - Math.min(...health)).toBeGreaterThan(5);
  expect(
    [...local.trees, ...local.plots].every(
      (p) =>
        p.health >= 0 && p.health <= 100 && p.scorch >= 0 && p.scorch <= 100,
    ),
  ).toBe(true);
});
it("a nearby fire scars trees and soil while remote places retain their state", () => {
  const w = createWorld(1);
  const [x, y] = treePosition(0);
  w.disasters = [{ kind: "fire", x, y, life: 400, people: [] }];
  for (let i = 0; i < 100; i++) updateLocalEnvironment(w);
  const local = ensureLocalEnvironment(w);
  expect(local.trees[0].scorch).toBeCloseTo(60);
  const far = local.trees.find(
    (_, i) => Math.hypot(treePosition(i)[0] - x, treePosition(i)[1] - y) > 10,
  )!;
  expect(far.scorch).toBe(0);
  expect(local.trees[0].health).toBeLessThan(far.health);
  expect(local.plots.some((p) => p.scorch > 0)).toBe(true);
});
it("wet recovery is gradual and preserves burn memory", () => {
  const w = createWorld(1);
  const local = ensureLocalEnvironment(w);
  local.trees[0] = { health: 10, scorch: 20 };
  w.moisture = w.water = 100;
  w.pressure = 0;
  updateLocalEnvironment(w);
  expect(local.trees[0].health).toBeGreaterThan(10);
  expect(local.trees[0].health).toBeLessThan(11);
  expect(local.trees[0].scorch).toBeGreaterThan(19);
});
it("supports old saves and preserves local damage through save/restore", () => {
  const w = createWorld(1);
  const legacy = restore(JSON.stringify(w));
  expect(legacy.localEnvironment).toBeUndefined();
  step(legacy);
  expect(legacy.localEnvironment?.trees).toHaveLength(135);
  ensureLocalEnvironment(legacy).plots[0].scorch = 40;
  const saved = restore(JSON.stringify(legacy));
  expect(saved.localEnvironment).toEqual(legacy.localEnvironment);
  saved.localEnvironment!.plots[0].health = NaN;
  expect(() => restore(JSON.stringify(saved))).toThrow("État local");
});
it("gives maintained occupied homes more upkeep than abandoned homes", () => {
  const w = createWorld(1);
  const b = w.buildings.find((b) => w.villagers.some((v) => v.home === b.id))!;
  const occupied = buildingWear(w, b).repair;
  w.villagers.filter((v) => v.home === b.id).forEach((v) => (v.dead = true));
  expect(buildingWear(w, b).repair).toBeLessThan(occupied);
  expect(plotPosition(35).every((v) => v > 0 && v < 29)).toBe(true);
});

it("keeps geographic exposure stable when the village random state advances", () => {
  const w = createWorld(1);
  const before = buildingWear(w, w.buildings[0]);
  const other = structuredClone(w);
  other.seed = 987654;
  expect(buildingWear(other, other.buildings[0])).toEqual(before);
  updateLocalEnvironment(w);
  updateLocalEnvironment(other);
  expect(other.localEnvironment).toEqual(w.localEnvironment);
});
