/** Deterministic irregular idle events: reload, pause and reduced motion remain stable. */
export function carrierPose(time: number, id: number) {
  const shifted = Math.max(0, time + id * 7.37);
  const slot = Math.floor(shifted / 18);
  const hash = Math.abs(Math.sin(slot * 91.7 + id * 31.3 + 4.9));
  const start = 3 + hash * 6;
  const local = (shifted % 18) - start;
  if (local < 0) return 0;
  const sequences = [
    [0, 1, 2, 3, 2, 1, 0],
    [0, 4, 5, 4, 0],
    [0, 6, 7, 6, 0],
  ];
  const sequence =
    sequences[Math.floor(hash * sequences.length) % sequences.length];
  return sequence[Math.min(sequence.length - 1, Math.floor(local * 2))];
}

/** The first eight authored poses contain the complete stroke; later near-idles
 * are deliberately excluded so the swimmer never spends half a loop stationary. */
export const turtlePose = (time: number) =>
  Math.floor(Math.max(0, time) * 6) % 8;
