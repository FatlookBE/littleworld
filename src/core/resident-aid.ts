import type { Villager, World } from "./types";

const supplies = {
  water: { need: "thirst", threshold: 45, relief: 24, cost: 4, label: "Offrir de l’eau" },
  food: { need: "hunger", threshold: 50, relief: 25, cost: 5, label: "Offrir un repas" },
} as const;

export type ResidentAidSupply = keyof typeof supplies;
const items = ["water", "food"] as const;
export const residentAidRestTicks = 60;

function option(w: World, v: Villager, supply: ResidentAidSupply) {
  const item = supplies[supply];
  const reason = v.dead
    ? "Cet habitant est décédé."
    : w.tick < (v.aidAfter ?? 0)
      ? "Cet habitant vient de recevoir de l’aide."
      : v[item.need] < item.threshold
        ? "Cet habitant n’en a pas besoin pour l’instant."
        : w[supply] < item.cost
          ? "Les réserves sont insuffisantes."
          : null;
  return { supply, ...item, reason };
}

export function residentAidOptions(w: World, v: Villager) {
  return items.map((supply) => option(w, v, supply));
}

export function giveResidentAid(w: World, resident: number, supply: ResidentAidSupply) {
  const v = w.villagers[resident];
  if (!v || v.id !== resident) return null;
  const item = option(w, v, supply);
  if (item.reason) return null;
  w[supply] -= item.cost;
  v[item.need] = Math.max(0, v[item.need] - item.relief);
  v.aidAfter = w.tick + residentAidRestTicks;
  return supply === "water"
    ? `${v.name} reçoit une gourde puisée dans les réserves du village.`
    : `${v.name} reçoit un repas tiré des provisions du village.`;
}
