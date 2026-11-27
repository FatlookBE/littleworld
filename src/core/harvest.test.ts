import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import { cropRows } from "./crops";
import {
  finishHarvest,
  harvestAction,
  harvestJob,
  harvestStop,
} from "./harvest";
import { findRoute } from "./navigation";
import { restore } from "./persistence";
import { DAYS_PER_SEASON } from "./seasons";
import { TICKS_PER_DAY } from "../daylight";
import { residentAction } from "../resident-actions";

function ready() {
  const w = createWorld(0);
  w.tick = 24;
  w.cropGrowth = [1, 0.8, 1, 0.9, 0.7, 0];
  const v = w.villagers[0];
  const target = harvestStop(0);
  Object.assign(v, {
    x: target[0],
    y: target[1],
    target,
    route: [],
    action: harvestAction,
    actionAt: w.tick - 12,
  });
  return { w, v };
}

it("assigns walkable, distinct work positions and reserves a mature row", () => {
  const { w, v } = ready();
  const peer = w.villagers[8];
  expect(
    new Set(
      Array.from({ length: cropRows }, (_, row) => harvestStop(row).join()),
    ).size,
  ).toBe(cropRows);
  for (let i = 0; i < cropRows; i++) {
    const stop = harvestStop(i);
    expect(findRoute(w, [v.x, v.y], stop).at(-1)).toEqual(stop);
  }
  expect(harvestJob(w, peer)).toEqual(harvestStop(2));
});

it("reuses the gathering animation and credits one crop once after arrival", () => {
  const { w, v } = ready();
  expect(residentAction(v, w)).toBe("gather");
  v.route = [v.target];
  expect(finishHarvest(w, v)).toBeUndefined();
  v.route = [];
  v.actionAt = w.tick - 11;
  expect(finishHarvest(w, v)).toBeUndefined();
  v.actionAt--;
  expect(finishHarvest(w, v)).toMatchObject({ row: 0, food: 4 });
  expect(w.food).toBe(92);
  expect(w.cropGrowth).toEqual([0, 0.8, 1, 0.9, 0.7, 0]);
  expect(finishHarvest(w, v)).toBeUndefined();
  expect(restore(JSON.stringify(w)).cropGrowth).toEqual(w.cropGrowth);
});

it("does not harvest during winter, a local fire, or when the pantry is full", () => {
  const { w, v } = ready();
  const tick = w.tick;
  w.tick += 3 * DAYS_PER_SEASON * TICKS_PER_DAY;
  expect(harvestJob(w, v)).toBeUndefined();
  expect(finishHarvest(w, v)).toBeUndefined();
  w.tick = tick;
  w.disasters = [{ kind: "fire", x: v.x, y: v.y, life: 20, people: [] }];
  expect(finishHarvest(w, v)).toBeUndefined();
  w.disasters = [];
  w.food = 98;
  expect(finishHarvest(w, v)).toBeUndefined();
  expect(w.cropGrowth?.[0]).toBe(1);
});

it("sends a free grower to ripe crops and reports the harvest at the farm and in the chronicle", () => {
  const { w, v } = ready();
  for (const other of w.villagers) {
    other.nextDecision = 9999;
    other.cooldown = 9999;
  }
  v.action = "Veille sur les cultures";
  v.nextDecision = w.tick;
  for (let i = 0; i < 16; i++) step(w);
  const event = w.chronicle.find((e) => e.text.includes("rentre la récolte"));
  expect(event).toMatchObject({
    person: v.id,
    text: expect.stringContaining("+4"),
  });
  expect(w.buildings.find((b) => b.type === "farm")?.events).toContain(event);
  expect(w.cropGrowth?.[0]).toBeLessThan(0.02);
});
