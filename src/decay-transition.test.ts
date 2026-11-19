import { afterEach, expect, it, vi } from "vitest";
import { decayTransition, paintDecayTransition } from "./decay-transition";
const ready = [true, true, true, true];
afterEach(() => vi.unstubAllGlobals());
it("keeps pure stages outside each band and blends continuously around milestones", () => {
  expect(decayTransition(0, ready)).toEqual({ from: 0, to: 0, progress: 0 });
  expect(decayTransition(1, ready)).toEqual({ from: 3, to: 3, progress: 0 });
  for (const [i, threshold] of [0.22, 0.48, 0.78].entries()) {
    const center = decayTransition(threshold, ready);
    expect(center.from).toBe(i);
    expect(center.to).toBe(i + 1);
    expect(center.progress).toBeCloseTo(0.5);
    expect(decayTransition(threshold - 0.049, ready).progress).toBeLessThan(
      0.001,
    );
    expect(decayTransition(threshold + 0.049, ready).progress).toBeGreaterThan(
      0.999,
    );
  }
});
it("is deterministic in recovery and falls back to a common loaded stage", () => {
  const decays = [0.19, 0.23, 0.49, 0.81];
  expect(
    [...decays]
      .reverse()
      .map((d) => decayTransition(d, ready))
      .reverse(),
  ).toEqual(decays.map((d) => decayTransition(d, ready)));
  expect(decayTransition(0.5, [true, true, false, false])).toEqual({
    from: 1,
    to: 1,
    progress: 0,
  });
  expect(decayTransition(1, [true, false, false, false])).toEqual({
    from: 0,
    to: 0,
    progress: 0,
  });
});
it("reduced motion uses a single stage at the existing thresholds", () => {
  expect(decayTransition(0.21, ready, true)).toEqual({
    from: 0,
    to: 0,
    progress: 0,
  });
  expect(decayTransition(0.22, ready, true)).toEqual({
    from: 1,
    to: 1,
    progress: 0,
  });
});
it("uses complementary opaque masks rather than translucent doubled silhouettes", () => {
  class Path {
    rect() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    addPath() {}
  }
  vi.stubGlobal("Path2D", Path);
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const draw = vi.fn();
  paintDecayTransition(ctx, { from: 1, to: 2, progress: 0.5 }, [0, 0], 1, draw);
  expect(draw.mock.calls).toEqual([[1], [2]]);
  expect(ctx.clip).toHaveBeenNthCalledWith(1, expect.any(Path), "evenodd");
  expect(ctx.clip).toHaveBeenNthCalledWith(2, expect.any(Path));
  expect(ctx.save).toHaveBeenCalledTimes(2);
  expect(ctx.restore).toHaveBeenCalledTimes(2);
  draw.mockClear();
  paintDecayTransition(ctx, { from: 3, to: 3, progress: 0 }, [0, 0], 1, draw);
  expect(draw.mock.calls).toEqual([[3]]);
});
