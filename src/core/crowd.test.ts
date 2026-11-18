import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import { moveResident, spreadDestination } from "./crowd";
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
    const stopped = w.villagers.filter((v) => !v.dead && !v.route.length);
    for (const v of stopped)
      largest = Math.max(
        largest,
        stopped.filter((o) => Math.hypot(o.x - v.x, o.y - v.y) < 0.7).length,
      );
  }
  expect(largest).toBeLessThanOrEqual(2);
  expect(w.villagers.every((v) => !v.dead)).toBe(true);
});
