import { expect, it } from "vitest";
import { createWorld } from "./core/engine";
import { youthFrame, youthStage } from "./young-residents";

it("changes the portrait and sprite stage at each age boundary", () => {
  expect([0, 2, 3, 11, 12, 17, 18].map(youthStage)).toEqual([
    "baby",
    "baby",
    "child",
    "child",
    "teen",
    "teen",
    null,
  ]);
});

it("uses locomotion en route and plays after arrival, with a still frame in reduced motion", () => {
  const world = createWorld(0);
  const child = world.villagers[0];
  child.age = 5;
  child.action = "Joue près de sa maison";
  child.route = [[child.x + 1, child.y]];
  expect(youthFrame(child, world, 0.4)).toBeLessThan(8);
  child.route = [];
  expect(youthFrame(child, world, 0.4)).toBe(10);
  world.settings.reducedMotion = true;
  expect(youthFrame(child, world, 20)).toBe(8);
  child.age = 1;
  child.action = "Rampe au seuil";
  expect(youthFrame(child, world, 20)).toBe(0);
});
