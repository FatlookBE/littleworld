import { describe, expect, it } from "vitest";
import { loopFrame } from "./animation";

describe("animation playback", () => {
  it.each([
    [8, 10],
    [12, 12],
  ])("visits every pose of a %i-frame loop before repeating", (count, fps) => {
    const sequence = Array.from({ length: count + 1 }, (_, i) =>
      loopFrame((i + 0.01) / fps, count, fps),
    );
    expect(new Set(sequence.slice(0, count)).size).toBe(count);
    expect(sequence[count]).toBe(sequence[0]);
  });
  it("keeps a paused clock stable and freezes reduced motion independently of offsets", () => {
    const paused = loopFrame(1.3, 12, 12, 7);
    expect(loopFrame(1.3, 12, 12, 7)).toBe(paused);
    for (const time of [0, 1.3, 500])
      expect(loopFrame(time, 12, 12, 7, true)).toBe(0);
    expect(loopFrame(0, 12, 12, 5)).not.toBe(loopFrame(0, 12, 12, 0));
  });
});
