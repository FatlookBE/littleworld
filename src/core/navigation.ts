import type { World } from "./types";
type Point = [number, number];
export const bridgeRows = [6, 15, 23] as const;
export const riverCenter = (y: number) => 3.7 + Math.sin(y * 0.24) * 1.6;
/** Visible water and traversable banks share the same remaining reserve. */
export const riverHalfWidth = (w: Pick<World, "water">) =>
  1.6 * Math.pow(Math.max(0, Math.min(100, w.water)) / 100, 0.7);
export function walkable(w: World, x: number, y: number) {
  if (x < 0 || y < 0 || x >= 29 || y >= 29) return false;
  const cx = x + 0.5,
    cy = y + 0.5;
  const river = riverCenter(cy);
  if (
    riverHalfWidth(w) > 0 &&
    Math.abs(cx - river) < riverHalfWidth(w) + 0.15 &&
    !bridgeRows.some((row) => y === row)
  )
    return false;
  return !w.buildings.some((b) => {
    if (b.type === "farm") return false;
    const width =
      b.type === "home"
        ? 1.8
        : b.type === "market"
          ? 2.8
          : b.type === "well"
            ? 1.1
            : b.type === "reservoir"
              ? 2.7
              : 2.3;
    const depth =
      b.type === "home"
        ? 1.5
        : b.type === "market"
          ? 3.1
          : b.type === "well"
            ? 1.1
            : b.type === "reservoir"
              ? 2.5
              : 1.9;
    return cx >= b.x && cx <= b.x + width && cy >= b.y && cy <= b.y + depth;
  });
}
function nearest(w: World, p: Point): Point {
  let best: Point = [13, 15],
    distance = Infinity;
  for (let y = 0; y < 29; y++)
    for (let x = 0; x < 29; x++)
      if (walkable(w, x, y)) {
        const d = (x + 0.5 - p[0]) ** 2 + (y + 0.5 - p[1]) ** 2;
        if (d < distance) {
          best = [x, y];
          distance = d;
        }
      }
  return best;
}
export function findRoute(w: World, from: Point, to: Point): Point[] {
  const start = nearest(w, from),
    end = nearest(w, to),
    key = (p: Point) => p[1] * 29 + p[0];
  const queue: Point[] = [start],
    parents = new Map<number, number>([[key(start), -1]]);
  for (let i = 0; i < queue.length && !parents.has(key(end)); i++) {
    const [x, y] = queue[i];
    for (const p of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as Point[]) {
      const id = key(p);
      if (!parents.has(id) && walkable(w, ...p)) {
        parents.set(id, key(queue[i]));
        queue.push(p);
      }
    }
  }
  if (!parents.has(key(end))) return [[start[0] + 0.5, start[1] + 0.5]];
  const result: Point[] = [];
  for (let id = key(end); id !== -1; id = parents.get(id)!) {
    result.unshift([(id % 29) + 0.5, Math.floor(id / 29) + 0.5]);
  }
  // Collapse straight stretches, retaining every corner and continuous movement.
  return result.filter(
    (p, i) =>
      i === 0 ||
      i === result.length - 1 ||
      p[0] - result[i - 1][0] !== result[i + 1][0] - p[0] ||
      p[1] - result[i - 1][1] !== result[i + 1][1] - p[1],
  );
}
