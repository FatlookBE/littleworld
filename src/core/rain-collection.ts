import { WEATHER_SLOT_TICKS } from "./seasons";
import type { Building, World } from "./types";

const maxCatch = 8;
const minimumCondition = 35;

export function rainCollection(w: World, reservoir: Building) {
  if (reservoir.type !== "reservoir") return null;
  const raining = w.weather === "Pluie légère";
  const intact = reservoir.condition >= minimumCondition;
  const collected =
    w.rainCollectedAt !== undefined &&
    Math.floor(w.rainCollectedAt / WEATHER_SLOT_TICKS) === Math.floor(w.tick / WEATHER_SLOT_TICKS);
  const amount = Math.min(maxCatch, Math.floor(100 - w.water));
  const unavailable = !intact
    ? "La réserve est trop abîmée pour recueillir l’eau."
    : !raining
      ? "Les seaux se remplissent quand il pleut, pas quand il neige."
      : collected
        ? "Les seaux ont déjà été vidés pour cette averse."
        : amount < 1
          ? "La réserve est pleine."
          : null;
  return { visible: raining && intact, collected, amount, unavailable };
}

export function collectRainwater(w: World, siteId: number) {
  const site = w.buildings.find((building) => building.id === siteId);
  const option = site && rainCollection(w, site);
  if (!site || !option || option.unavailable) return null;
  w.water += option.amount;
  w.rainCollectedAt = w.tick;
  return { site, amount: option.amount };
}
