import { loopFrame } from "./animation";

// Separate foraging patches leave room between birds even when they stop.
const patches = [
  { x: 6.1, y: 20.4, dx: 1.2, dy: 0.25, breed: 0 },
  { x: 8.5, y: 21.6, dx: -0.35, dy: 1.15, breed: 1 },
  { x: 6.3, y: 23.2, dx: 1.05, dy: 0.15, breed: 2 },
  { x: 10.3, y: 20.4, dx: -0.75, dy: 0.35, breed: 0 },
];

export function foragingHens(time: number) {
  return patches.map((patch, i) => {
    const t = time + i * 2.7;
    const walk = 2.8 + i * 0.22;
    const leg = walk + 3.4 + i * 0.4;
    const returning = Math.floor(t / leg) % 2 === 1;
    const elapsed = t % leg;
    const step = Math.min(1, elapsed / walk);
    const progress = returning ? 1 - step : step;
    return {
      breed: patch.breed,
      x: patch.x + patch.dx * progress,
      y: patch.y + patch.dy * progress,
      mirror: patch.dx < patch.dy !== returning,
      frame:
        elapsed < walk
          ? loopFrame(elapsed, 4, 7 + i * 0.3)
          : 4 + loopFrame(elapsed - walk, 4, 4 + i * 0.25),
    };
  });
}

// Four separate spots in the lee of the farmhouse, north of the crop rows.
const shelter: readonly [number, number][] = [
  [8.45, 19.6],
  [9.1, 19.84],
  [10, 19.95],
  [10.65, 20.14],
];

export function villageHens(
  time: number,
  cover: number,
  headingToCover: boolean,
  reducedMotion: boolean,
) {
  return foragingHens(reducedMotion ? 0 : time).map((hen, i) => {
    const [sx, sy] = shelter[i];
    const progress = Math.max(0, Math.min(1, (cover - i * 0.045) / (1 - i * 0.045)));
    if (!progress) return reducedMotion ? { ...hen, frame: 0 } : hen;
    const toward = sx - hen.x < sy - hen.y;
    return {
      ...hen,
      x: hen.x + (sx - hen.x) * progress,
      y: hen.y + (sy - hen.y) * progress,
      mirror: progress === 1 ? i % 2 === 0 : toward === headingToCover,
      frame: reducedMotion || progress === 1 ? 0 : loopFrame(time, 4, 11, i),
    };
  });
}
