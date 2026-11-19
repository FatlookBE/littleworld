import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import { moveResident, spreadDestination } from "./crowd";
import { indoors } from "./shelter";
import { walkable } from "./navigation";
it("reserves separate walkable stopping places for a group visiting one location", () => {
  const w = createWorld(0);
  const reserved: number[][] = [];
  for (const v of w.villagers) {
    v.target = spreadDestination(w, v, [13.5, 14.5]);
    reserved.push(v.target);
    expect(walkable(w, Math.floor(v.target[0]), Math.floor(v.target[1]))).toBe(
      true,
    );
  }
  expect(new Set(reserved.map((p) => p.join(","))).size).toBe(24);
});
it("opposing pedestrians can cross a shared path without a permanent deadlock", () => {
  const w = createWorld(0);
  w.villagers.forEach((v) => (v.dead = true));
  const [a, b] = w.villagers;
  a.dead = b.dead = false;
  a.x = 11.5;
  a.y = 26.5;
  b.x = 17.5;
  b.y = 26.5;
  a.route = [[17.5, 26.5]];
  b.route = [[11.5, 26.5]];
  for (let i = 0; i < 140; i++) {
    moveResident(w, a, 0.1);
    moveResident(w, b, 0.1);
  }
  expect(a.x).toBeGreaterThan(17.3);
  expect(b.x).toBeLessThan(11.7);
});
it("stationary villagers do not accumulate in persistent groups at shared destinations", () => {
  const w = createWorld(0);
  let largest = 0;
  for (let tick = 0; tick < 3000; tick++) {
    step(w);
    if (tick < 500 || tick % 40 !== 0) continue;
    const stopped = w.villagers.filter(
      (v) => !v.dead && !indoors(v, w) && !v.route.length,
    );
    for (const v of stopped)
      largest = Math.max(
        largest,
        stopped.filter((o) => Math.hypot(o.x - v.x, o.y - v.y) < 0.7).length,
      );
  }
  expect(largest).toBeLessThanOrEqual(2);
  expect(w.villagers.every((v) => !v.dead)).toBe(true);
});

it("walkers detour around a stationary neighbour instead of waiting forever", () => {
  const w = createWorld(0);
  w.villagers.forEach((v) => (v.dead = true));
  const [a, b] = w.villagers;
  a.dead = b.dead = false;
  a.x = 11.5;
  a.y = 26.5;
  a.target = [17.5, 26.5];
  a.route = [[17.5, 26.5]];
  b.x = 14.5;
  b.y = 26.5;
  b.target = [b.x, b.y];
  b.route = [];
  for (let i = 0; i < 240; i++) moveResident(w, a, 0.1);
  expect(a.x).toBeGreaterThan(17.3);
  expect(a.target).toEqual([17.5, 26.5]);
});
it("sidesteps do not cut through solid building corners", () => {
  const w = createWorld(0);
  w.water = 0;
  w.villagers.forEach((v) => (v.dead = true));
  const v = w.villagers[0];
  v.dead = false;
  v.x = 7.99;
  v.y = 9.1;
  v.target = [8.1, 8.99];
  v.route = [[8.1, 8.99]];
  const start = [v.x, v.y];
  moveResident(w, v, 0.2);
  for (let i = 1; i <= 20; i++) {
    expect(
      walkable(
        w,
        Math.floor(start[0] + ((v.x - start[0]) * i) / 20),
        Math.floor(start[1] + ((v.y - start[1]) * i) / 20),
      ),
    ).toBe(true);
  }
});
