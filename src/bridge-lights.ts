import { daylight } from "./daylight";
import { bridgeRows, riverCenter } from "./core/navigation";
import type { World } from "./core/types";

const west = bridgeRows[1] - 0.4;
const east = bridgeRows[1] + 3;
export const bridgeLanternSites: [number, number][] = [
  [riverCenter(west) - 2.2, west],
  [riverCenter(east) + 2.2, east],
];

type LightWorld = Pick<
  World,
  "tick" | "stories" | "weather" | "villagers" | "buildings"
>;

/** A successful story unlocks the evening ritual, not a permanent weather effect. */
export function bridgeLight(w: LightWorld, visualTick = w.tick) {
  if (!w.stories?.traces?.includes("lanterns")) return null;
  const workshop = w.buildings.find((b) => b.type === "workshop");
  if (
    !workshop ||
    workshop.condition < 25 ||
    !w.villagers.some((v) => !v.dead && v.age >= 18)
  ) {
    return {
      strength: 0,
      label: "Éteintes : personne ne peut entretenir les lanternes.",
    };
  }
  if (w.weather === "Vent de poussière") {
    return { strength: 0, label: "Éteintes le temps du vent de poussière." };
  }
  const strength = Math.max(
    0,
    Math.min(1, (0.67 - daylight(visualTick)) / 0.67),
  );
  return strength > 0
    ? { strength, label: "Allumées : les deux rives se répondent." }
    : { strength, label: "Les lanternes sont ressorties à la tombée du jour." };
}
