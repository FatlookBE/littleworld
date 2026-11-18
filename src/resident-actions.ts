import type { Villager, World } from "./core/types";

export type ResidentAction = "gather" | "work" | "drink" | "eat";

/** An activity starts at its destination, never while travelling or fighting. */
export function residentAction(v: Villager, w: World): ResidentAction | null {
  if (
    v.dead ||
    v.health < 30 ||
    v.morale < 25 ||
    v.route.length > 0 ||
    Math.hypot(v.x - v.target[0], v.y - v.target[1]) >= 0.3 ||
    (v.hitAt !== undefined && w.tick - v.hitAt >= 0 && w.tick - v.hitAt < 4) ||
    w.disasters?.some((e) => e.kind === "fight" && e.people.includes(v.id))
  )
    return null;
  const action = v.action.toLocaleLowerCase("fr");
  if (/puits|boit au point d’eau/.test(action))
    return w.water > 1 ? "drink" : null;
  if (/repas|manger/.test(action)) return w.food > 1 ? "eat" : null;
  if (/cueille|cultures|récolte|verger/.test(action))
    return "gather";
  if (/répare|atelier|pompe|jette de l’eau/.test(action)) return "work";
  return null;
}
