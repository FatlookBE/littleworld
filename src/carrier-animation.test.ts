import { expect, it } from "vitest";
import { carrierPose, turtlePose } from "./carrier-animation";
it("carriers use bounded authored poses with independently timed varied events", () => {
  const poses = new Set<number>();
  let different = false;
  for (let t = 0; t < 100; t += 0.25) {
    const a = carrierPose(t, 0),
      b = carrierPose(t, 1),
      turtle = turtlePose(t);
    poses.add(a);
    different ||= a !== b;
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(8);
    expect(turtle).toBeLessThan(16);
    expect(carrierPose(t, 0)).toBe(a);
  }
  expect(poses.size).toBeGreaterThan(5);
  expect(different).toBe(true);
});

it("turtle swimming advances through all eight active poses continuously without idle gaps", () => {
  const frames = Array.from({ length: 17 }, (_, i) =>
    turtlePose((i + 0.01) / 6),
  );
  expect(frames.slice(0, 8)).toEqual(Array.from({ length: 8 }, (_, i) => i));
  expect(frames.slice(8, 16)).toEqual(frames.slice(0, 8));
  expect(turtlePose(0)).toBe(0);
});
