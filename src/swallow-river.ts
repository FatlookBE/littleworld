import { hourOf } from "./daylight";
import { riverCenter } from "./core/navigation";
import { isWet, season, seasonProgress } from "./core/seasons";
import type { World } from "./core/types";

type RiverConditions = Pick<World, "tick" | "weather" | "water" | "pressure">;
const firstPassHour = 11 + 18 / 60;
const passHours = 2.7;
const secondPassDelay = 0.31;
const routeStart = 5.6;
const routeLength = 18.6;
const unit = (x: number) => Math.max(0, Math.min(1, x));

function riverFlightBlock(w: RiverConditions) {
  const s = season(w.tick);
  if (s !== 1 && !(s === 0 && seasonProgress(w.tick) >= 0.3)) return "season";
  if (isWet(w) || w.weather === "Vent de poussière") return "weather";
  if (w.water <= 45) return "water";
  if (w.pressure >= 64) return "pressure";
  return null;
}

/** A short, repeatable midday foraging pass follows the actual river bends. */
export function riverSwallows(w: RiverConditions, tick = w.tick) {
  if (riverFlightBlock(w)) return [];
  const hour = hourOf(tick);
  return [0, secondPassDelay].flatMap((delay, i) => {
    const progress = (hour - firstPassHour - delay) / passHours;
    if (progress <= 0 || progress >= 1) return [];
    const y = routeStart + routeLength * progress;
    const x = riverCenter(y) + (i === 0 ? 0.42 : -0.42);
    const z = 24 + 24 * Math.abs(2 * progress - 1) ** 2;
    const visibility =
      Math.min(unit(progress / 0.12), unit((1 - progress) / 0.12)) *
      unit((w.water - 45) / 11) *
      unit((64 - w.pressure) / 12);
    return [{ x, y, z, visibility, beat: i * 4 }];
  });
}

/** The chronicle uses the same conditions and river coordinates as the renderer. */
export function riverWatch(
  w: RiverConditions & { settings: Pick<World["settings"], "reducedMotion"> },
) {
  const reason = w.settings.reducedMotion ? "motion" : riverFlightBlock(w);
  const birds = reason
    ? []
    : riverSwallows(w).filter((bird) => bird.visibility > 0);
  const hour = hourOf(w.tick);
  const status =
    reason ??
    (birds.length ? "active" : hour <= firstPassHour ? "upcoming" : "over");
  const y = birds.length
    ? birds.reduce((sum, bird) => sum + bird.y, 0) / birds.length
    : routeStart + routeLength / 2;
  return { status, x: riverCenter(y), y };
}
