import { expect, it } from "vitest";
import { decayOf, turtleStage } from "./foundation";

const world = (pressure: number, water: number, food: number, dead = 0) => ({
  pressure,
  water,
  food,
  villagers: Array.from({ length: 24 }, (_, i) => ({ dead: i < dead })),
});
it("rot grows with pressure, scarcity and deaths, and stays within 0..1", () => {
  expect(decayOf(world(0, 100, 100))).toBe(0);
  const mid = decayOf(world(50, 60, 60));
  const worse = decayOf(world(50, 10, 10, 12));
  expect(mid).toBeGreaterThan(0.2);
  expect(worse).toBeGreaterThan(mid);
  expect(decayOf(world(100, 0, 0, 24))).toBe(1);
});

it("keeps four distinct turtle stages throughout the collapse", () => {
  expect([0, 0.21, 0.22, 0.47, 0.48, 0.77, 0.78, 1].map(turtleStage))
    .toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
});
