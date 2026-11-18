import type { World } from "./types";

/** A season lasts four village days (4 × 288 ticks); the first day is in spring. */
export const DAYS_PER_SEASON = 4;
const SEASON_TICKS = 288 * DAYS_PER_SEASON;
export const seasonNames = ["Printemps", "Été", "Automne", "Hiver"] as const;
export type Season = 0 | 1 | 2 | 3;

export const season = (tick: number) =>
  (Math.floor(tick / SEASON_TICKS) % 4) as Season;
/** 0 → 1 across the current season. */
export const seasonProgress = (tick: number) =>
  (tick % SEASON_TICKS) / SEASON_TICKS;

/** Whole village days left before the season changes (≥ 1). */
export const daysToNextSeason = (tick: number) =>
  DAYS_PER_SEASON - Math.floor((tick % SEASON_TICKS) / 288);

const ramp = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Snow settles over the first winter day and melts during the first spring day. */
export function snowCover(tick: number) {
  const s = season(tick),
    k = seasonProgress(tick);
  if (s === 3) return ramp(0.02, 0.3, k);
  if (s === 0) return 1 - ramp(0, 0.22, k);
  return 0;
}
/** Autumn colours turn in, then fade as the leaves fall into winter. */
export function autumnColour(tick: number) {
  const s = season(tick),
    k = seasonProgress(tick);
  if (s === 2) return ramp(0, 0.35, k);
  if (s === 3) return 1 - ramp(0, 0.3, k);
  return 0;
}

/** Weather rotates every 150 ticks; the season decides which slots are wet. */
const wetSlots: Record<Season, number[]> = {
  0: [1, 3],
  1: [3],
  2: [0, 3],
  3: [3],
};
export function seasonalWeather(w: World, p: number) {
  const s = season(w.tick),
    slot = Math.floor(w.tick / 150) % 5;
  if (p > 0.72) return "Vent de poussière";
  if (wetSlots[s].includes(slot))
    return s === 3 ? "Neige légère" : "Pluie légère";
  if (p > 0.4 || (s === 1 && slot === 2)) return "Chaleur sèche";
  return s === 3 ? "Ciel froid" : "Ciel clair";
}
export const isWet = (w: Pick<World, "weather">) =>
  w.weather === "Pluie légère" || w.weather === "Neige légère";

/** Seasonal multipliers: summer evaporates, autumn harvests, winter rests. */
export const seasonEffects: Record<
  Season,
  { harvest: number; evaporation: number; fire: number }
> = {
  0: { harvest: 1, evaporation: 0, fire: 0.8 },
  1: { harvest: 1.1, evaporation: 0.015, fire: 1.5 },
  2: { harvest: 1.25, evaporation: 0.01, fire: 1 },
  3: { harvest: 0.6, evaporation: -0.01, fire: 0.4 },
};

/** Share of deciduous trees standing bare: late autumn, all winter, early spring. */
export function bareBranches(tick: number) {
  const s = season(tick),
    k = seasonProgress(tick);
  if (s === 2) return ramp(0.45, 1, k) * 0.75;
  if (s === 3) return 0.75 + 0.25 * ramp(0, 0.3, k);
  if (s === 0) return 1 - ramp(0.05, 0.4, k);
  return 0;
}
