import { expect, it } from "vitest";
import { createWorld } from "./engine";
import { growCrops } from "./crops";
import { restore } from "./persistence";

it("grows staggered rows to maturity and preserves their progress on reload", () => {
  const w = createWorld(0);
  growCrops(w);
  expect(new Set(w.cropGrowth).size).toBeGreaterThan(1);
  for (let i = 0; i < 1500; i++) growCrops(w);
  expect(w.cropGrowth).toEqual(Array(6).fill(1));
  expect(restore(JSON.stringify(w)).cropGrowth).toEqual(w.cropGrowth);
  w.moisture = 0;
  growCrops(w);
  expect(w.cropGrowth?.every((value) => value < 1)).toBe(true);
});
