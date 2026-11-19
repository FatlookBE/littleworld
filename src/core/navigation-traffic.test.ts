import { expect, it } from "vitest";
import { createWorld } from "./engine";
import { findRoute } from "./navigation";
it("routes around temporarily occupied cells while preserving its endpoints", () => {
  const w = createWorld(0);
  const path = findRoute(w, [11.5, 26.5], [17.5, 26.5], [[14.5, 26.5]]);
  expect(path.at(-1)).toEqual([17.5, 26.5]);
  let previous: [number, number] = [11.5, 26.5];
  for (const point of path) {
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(point[0] - previous[0], point[1] - previous[1]) * 4),
    );
    for (let i = 0; i <= steps; i++)
      expect([
        Math.floor(previous[0] + ((point[0] - previous[0]) * i) / steps),
        Math.floor(previous[1] + ((point[1] - previous[1]) * i) / steps),
      ]).not.toEqual([14, 26]);
    previous = point;
  }
});
