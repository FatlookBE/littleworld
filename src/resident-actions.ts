import type { Villager, World } from "./core/types";

export type ResidentAction =
  "gather" | "work" | "drink" | "eat" | "bake" | "care" | "carry";

export function residentActivityAllowed(v: Villager, w: World) {
  return !(
    v.dead ||
    v.health < 30 ||
    v.morale < 25 ||
    (v.visit && v.visit.phase !== "approaching") ||
    (v.hitAt !== undefined && w.tick - v.hitAt >= 0 && w.tick - v.hitAt < 4) ||
    w.disasters?.some((e) => e.kind === "fight" && e.people.includes(v.id))
  );
}

/** An activity starts at its destination, never while travelling or fighting. */
export function residentAction(v: Villager, w: World): ResidentAction | null {
  if (!residentActivityAllowed(v, w)) return null;
  const action = v.action.toLocaleLowerCase("fr");
  // Carrying uses an actual walking sheet during travel; all other activities
  // remain stationary and start only at the destination.
  if (/porte de l’eau|transporte de l’eau/.test(action))
    return w.water > 1 ? "carry" : null;
  if (
    v.route.length > 0 ||
    Math.hypot(v.x - v.target[0], v.y - v.target[1]) >= 0.3
  )
    return null;
  if (/pétrit|pain|boulanger/.test(action)) return w.food > 1 ? "bake" : null;
  if (/soigne/.test(action)) return "care";
  if (/puits|boit au point d’eau/.test(action))
    return w.water > 1 ? "drink" : null;
  if (/repas|manger/.test(action)) return w.food > 1 ? "eat" : null;
  if (/cueille|cultures|récolte|verger/.test(action)) return "gather";
  if (/répare|reconstruit|atelier|pompe|jette de l’eau/.test(action))
    return "work";
  return null;
}

/** Arrival/action timestamps use the simulation clock (one tick = 0.2 seconds). */
export function residentActionTime(v: Villager, time: number) {
  return Math.max(0, time - (v.actionAt === undefined ? 0 : v.actionAt * 0.2));
}
