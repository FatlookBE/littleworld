import type { Building, Villager, World } from "./types";
import { walkable } from "./navigation";

export function canRebuild(w: World, v: Villager, b: Building) {
  return (
    !v.dead &&
    !v.visit &&
    !(v.hitAt !== undefined && w.tick - v.hitAt >= 0 && w.tick - v.hitAt < 4) &&
    v.health >= 55 &&
    v.energy >= 30 &&
    v.hunger < 50 &&
    v.thirst < 45 &&
    w.pressure < 20 &&
    w.food > 30 &&
    w.water > 30 &&
    b.condition < 85 &&
    b.type !== "farm" &&
    !w.disasters?.some(
      (e) =>
        e.life > 0 &&
        (e.kind === "quake" ||
          (e.kind === "fight" && e.people.includes(v.id)) ||
          ((e.kind === "fire" || e.kind === "monster") &&
            Math.hypot(e.x - b.x, e.y - b.y) < 4)),
    )
  );
}

/** Keep repairs close to the building and leave space for normal traffic. */
export function reconstructionJob(w: World, v: Villager) {
  const candidates = w.buildings.filter(
    (b) =>
      b.condition < 70 &&
      canRebuild(w, v, b) &&
      !w.villagers.some(
        (other) =>
          !other.dead &&
          other.id !== v.id &&
          other.repairTarget === b.id &&
          other.action.startsWith("Reconstruit"),
      ),
  );
  candidates.sort(
    (a, b) =>
      Number(b.type === "well") - Number(a.type === "well") ||
      a.condition - b.condition ||
      a.id - b.id,
  );
  for (const b of candidates) {
    const stops: [number, number][] = [
      [b.x + 0.5, b.y + 2.5],
      [b.x + 2.5, b.y + 0.5],
      [b.x - 0.5, b.y + 0.5],
      [b.x + 0.5, b.y - 0.5],
    ];
    const target = stops.find(
      ([x, y]) =>
        walkable(w, Math.floor(x), Math.floor(y)) &&
        !w.villagers.some(
          (other) =>
            !other.dead &&
            !other.visit &&
            other.id !== v.id &&
            (Math.hypot(x - other.x, y - other.y) < 0.8 ||
              Math.hypot(x - other.target[0], y - other.target[1]) < 0.8),
        ),
    );
    if (target) return { b, target };
  }
}

export function repairAtDestination(w: World, v: Villager) {
  const b = w.buildings[v.repairTarget ?? -1];
  if (
    !b ||
    !v.action.startsWith("Reconstruit") ||
    !canRebuild(w, v, b) ||
    v.route.length ||
    Math.hypot(v.x - v.target[0], v.y - v.target[1]) >= 0.3 ||
    Math.hypot(v.x - b.x, v.y - b.y) > 3
  )
    return;
  const before = b.condition;
  b.condition = Math.min(85, before + 0.18);
  v.energy = Math.max(0, v.energy - 0.12);
  if (
    [15, 40, 70].some(
      (threshold) => before <= threshold && b.condition > threshold,
    )
  )
    return b;
}
