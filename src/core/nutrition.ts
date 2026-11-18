import type { Villager } from "./types";

/** Lasting deprivation, distinct from the immediate hunger meter. */
export function updateNutrition(v: Villager) {
  if (v.dead) return;
  const previous = v.malnutrition ?? 0;
  const change =
    v.hunger > 65 ? 0.08 + (v.hunger - 65) * 0.008 : v.hunger < 35 ? -0.06 : 0;
  v.malnutrition = Math.max(0, Math.min(100, previous + change));
}
export function nutritionStage(v: Pick<Villager, "malnutrition">) {
  const value = v.malnutrition ?? 0;
  return value >= 55 ? 2 : value >= 20 ? 1 : 0;
}
