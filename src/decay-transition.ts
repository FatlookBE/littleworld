export interface DecayTransition {
  from: number;
  to: number;
  progress: number;
}
const thresholds = [0.22, 0.48, 0.78];
/** A ten-point band around each milestone; deterministic in both directions. */
export function decayTransition(
  decay: number,
  ready: readonly boolean[],
  reduced = false,
): DecayTransition {
  let from = 0,
    to = 0,
    progress = 0;
  const value = Math.max(0, Math.min(1, decay));
  for (let i = 0; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    if (value >= threshold + 0.05 || (reduced && value >= threshold)) {
      from = to = i + 1;
    } else if (!reduced && value > threshold - 0.05) {
      from = i;
      to = i + 1;
      const t = (value - threshold + 0.05) / 0.1;
      progress = t * t * (3 - 2 * t);
      break;
    } else break;
  }
  while (from > 0 && !ready[from]) from--;
  if (!ready[to]) {
    to = from;
    progress = 0;
  }
  if (from === to) progress = 0;
  return { from, to, progress };
}
/** Complementary spatial masks avoid translucent/doubled carrier silhouettes.
 * The same world-anchored patches are shared by ground, cliff and fauna. */
export function paintDecayTransition(
  ctx: CanvasRenderingContext2D,
  transition: DecayTransition,
  center: [number, number],
  scale: number,
  paint: (stage: number) => void,
) {
  const { from, to, progress } = transition;
  if (from === to || progress <= 0) {
    paint(from);
    return;
  }
  if (progress >= 1) {
    paint(to);
    return;
  }
  const patches = new Path2D();
  const outside = new Path2D();
  const [cx, cy] = center;
  const spacing = 110;
  outside.rect(cx - 1200 * scale, cy - 800 * scale, 2400 * scale, 3000 * scale);
  for (let row = -6; row <= 18; row++) {
    for (let col = -9; col <= 9; col++) {
      const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
      const variation = n - Math.floor(n);
      const growth = Math.max(
        0,
        Math.min(1, (progress - variation * 0.18) / 0.82),
      );
      if (!growth) continue;
      const left = cx + (col - 0.5) * spacing * scale;
      const top = cy + row * spacing * scale;
      const size = spacing * scale;
      const patch = new Path2D();
      patch.moveTo(left, top);
      // Adjacent cells never overlap, so even-odd gives an exact complement.
      for (let step = 0; step <= 6; step++) {
        const wave =
          Math.sin(step * 1.7 + variation * 9) *
          Math.sin(growth * Math.PI) *
          0.15;
        const width = Math.max(0, Math.min(1, growth + wave));
        patch.lineTo(left + size * width, top + (size * step) / 6);
      }
      patch.lineTo(left, top + size);
      patch.closePath();
      patches.addPath(patch);
      outside.addPath(patch);
    }
  }
  ctx.save();
  ctx.clip(outside, "evenodd");
  paint(from);
  ctx.restore();
  ctx.save();
  ctx.clip(patches);
  paint(to);
  ctx.restore();
}
