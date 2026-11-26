import { hourOf, TICKS_PER_DAY } from "../daylight";
import { indoors } from "./shelter";
import type { Building, World } from "./types";

const waterCost = 2;
const breadYield = 5;
const kneadingTicks = 14;
const freshnessTicks = 36;

export const breadDisplayPosition = (site: Building): [number, number] => [
  site.x + 1.7,
  site.y + 2.85,
];

export function bakeryState(w: World, site: Building) {
  if (site.type !== "bakery") return null;
  const bakedAt = w.breadBakedAt;
  const today =
    bakedAt !== undefined &&
    Math.floor(w.tick / TICKS_PER_DAY) === Math.floor(bakedAt / TICKS_PER_DAY);
  const unsafe =
    site.condition < 45 ||
    w.disasters?.some(
      (e) =>
        e.life > 0 &&
        (e.kind === "quake" ||
          (["fire", "monster", "fight"].includes(e.kind) &&
            Math.hypot(site.x - e.x, site.y - e.y) < 4)),
    );
  const hour = hourOf(w.tick);
  const message = unsafe
    ? "Le four est à l’arrêt : le bâtiment est abîmé ou le quartier est en danger."
    : today
      ? "La fournée du jour est dans le garde-manger."
      : hour < 8 || hour >= 19
        ? "Le four fonctionne entre 8 h et 19 h, à l’heure du village."
        : w.water < 27
          ? "Le four garde l’eau pour le village : 25 points doivent rester en réserve."
          : w.fertility < 30
            ? "Les terres sont trop pauvres pour fournir assez de farine."
            : w.food > 100 - breadYield
              ? "Le garde-manger est assez rempli pour aujourd’hui."
              : null;
  return {
    message,
    fresh:
      !unsafe &&
      bakedAt !== undefined &&
      w.tick - bakedAt < freshnessTicks &&
      today,
  };
}

export function finishDailyBread(w: World) {
  const site = w.buildings.find((b) => b.type === "bakery");
  if (!site || bakeryState(w, site)?.message !== null) return null;
  const baker = w.villagers.find(
    (v) =>
      !v.dead &&
      v.health >= 30 &&
      v.age >= 18 &&
      !indoors(v, w) &&
      !v.route.length &&
      v.action === "Pétrit le pain" &&
      v.actionAt !== undefined &&
      w.tick - v.actionAt >= kneadingTicks &&
      Math.hypot(v.x - v.target[0], v.y - v.target[1]) < 0.3 &&
      Math.hypot(v.x - (site.x + 0.5), v.y - (site.y + 2.5)) <= 3,
  );
  if (!baker) return null;
  w.water -= waterCost;
  w.food += breadYield;
  w.breadBakedAt = w.tick;
  return { site, baker, breadYield, waterCost };
}
