import { indoors } from "./shelter";
import type { Villager, World } from "./types";
import { findRoute, walkable } from "./navigation";
type Point = [number, number];
const spacing = 0.8;
/** Reserve nearby stopping places instead of sending everyone to one exact coordinate. */
export function spreadDestination(w: World, v: Villager, target: Point): Point {
  let best: Point = target,
    score = Infinity;
  const peers = w.villagers.filter(
    (other) => !other.dead && !indoors(other, w) && other.id !== v.id,
  );
  for (
    let y = Math.max(0, Math.floor(target[1]) - 4);
    y <= Math.min(28, Math.floor(target[1]) + 4);
    y++
  )
    for (
      let x = Math.max(0, Math.floor(target[0]) - 4);
      x <= Math.min(28, Math.floor(target[0]) + 4);
      x++
    ) {
      if (!walkable(w, x, y)) continue;
      const p: Point = [x + 0.5, y + 0.5];
      const occupied = peers.reduce(
        (n, other) =>
          n +
          (Math.hypot(p[0] - other.target[0], p[1] - other.target[1]) < spacing
            ? 12
            : 0) +
          (Math.hypot(p[0] - other.x, p[1] - other.y) < spacing ? 8 : 0),
        0,
      );
      const rank =
        Math.hypot(p[0] - target[0], p[1] - target[1]) +
        occupied +
        Math.hypot(p[0] - v.x, p[1] - v.y) * 0.02;
      if (rank < score) {
        score = rank;
        best = p;
      }
    }
  return best;
}
/** Local yielding and side steps preserve the route while avoiding living neighbours. */
export function moveResident(w: World, v: Villager, speed: number) {
  const next = v.route[0];
  if (!next) {
    v.walkWait = 0;
    return;
  }
  const dx = next[0] - v.x,
    dy = next[1] - v.y,
    d = Math.hypot(dx, dy);
  if (d < 0.06) {
    v.route.shift();
    return;
  }
  const distance = Math.min(speed, d),
    heading = Math.atan2(dy, dx);
  const peers = w.villagers.filter(
    (other) =>
      !other.dead &&
      !indoors(other, w) &&
      other.id !== v.id &&
      Math.hypot(other.x - v.x, other.y - v.y) < 1.6,
  );
  let best: Point | undefined,
    bestScore = Infinity;
  const side = v.id % 2 ? 1 : -1;
  for (const angle of [
    0,
    side * 0.55,
    -side * 0.55,
    side * 1.1,
    -side * 1.1,
    side * 1.57,
    -side * 1.57,
  ]) {
    const x = v.x + Math.cos(heading + angle) * distance,
      y = v.y + Math.sin(heading + angle) * distance;
    // Test the whole short segment, not just its endpoint: a diagonal sidestep
    // must not cut through the corner of a house or across a wet river bank.
    const samples = Math.max(1, Math.ceil(distance / 0.04));
    let clear = true;
    for (let i = 1; i <= samples; i++) {
      if (
        !walkable(
          w,
          Math.floor(v.x + ((x - v.x) * i) / samples),
          Math.floor(v.y + ((y - v.y) * i) / samples),
        )
      ) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    let penalty = 0;
    for (const other of peers) {
      const after = Math.hypot(x - other.x, y - other.y);
      penalty = Math.max(penalty, Math.max(0, spacing - after) * 0.7);
    }
    const score =
      Math.hypot(next[0] - x, next[1] - y) + penalty + Math.abs(angle) * 0.005;
    if (score < bestScore) {
      bestScore = score;
      best = [x, y];
    }
  }
  const progress = best
    ? d - Math.hypot(next[0] - best[0], next[1] - best[1])
    : 0;
  if (best) {
    v.x = best[0];
    v.y = best[1];
  }
  v.walkWait =
    progress < distance * 0.15 ? Math.min(1000, (v.walkWait ?? 0) + 1) : 0;
  if (Math.hypot(v.x - next[0], v.y - next[1]) < 0.06) v.route.shift();
  if (v.route.length && v.walkWait >= 24) {
    const occupied: Point[] = peers
      .filter((other) => other.route.length === 0 || (other.walkWait ?? 0) > 12)
      .map((other) => [other.x, other.y]);
    const alternative = findRoute(w, [v.x, v.y], v.target, occupied);
    const end = alternative.at(-1);
    if (end && Math.hypot(end[0] - v.target[0], end[1] - v.target[1]) < 0.2)
      v.route = alternative;
    v.walkWait = 0;
  }
  if (!v.route.length) v.nextDecision = w.tick + 40;
}
