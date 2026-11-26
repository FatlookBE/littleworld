import { hourOf } from "./daylight";
import { riverCenter } from "./core/navigation";
import { isWet, season, seasonProgress } from "./core/seasons";
import type { World } from "./core/types";

type RiverConditions = Pick<World, "tick" | "weather" | "water" | "pressure">;
const unit = (x: number) => Math.max(0, Math.min(1, x));

/** A short, repeatable midday foraging pass follows the actual river bends. */
export function riverSwallows(w: RiverConditions, tick = w.tick) {
  const s = season(w.tick);
  if (
    (s !== 1 && !(s === 0 && seasonProgress(w.tick) >= 0.3)) ||
    isWet(w) ||
    w.weather === "Vent de poussière" ||
    w.water < 45 ||
    w.pressure >= 64
  )
    return [];
  const hour = hourOf(tick);
  return [0, 0.31].flatMap((delay, i) => {
    const progress = (hour - 11.3 - delay) / 2.7;
    if (progress <= 0 || progress >= 1) return [];
    const y = 5.6 + 18.6 * progress;
    const x = riverCenter(y) + (i === 0 ? 0.42 : -0.42);
    const z = 24 + 24 * Math.abs(2 * progress - 1) ** 2;
    const visibility =
      Math.min(unit(progress / 0.12), unit((1 - progress) / 0.12)) *
      unit((w.water - 45) / 11) *
      unit((64 - w.pressure) / 12);
    return [{ x, y, z, visibility, beat: i * 4 }];
  });
}
