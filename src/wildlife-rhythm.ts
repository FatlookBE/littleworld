import { daylight } from "./daylight";
import { isWet, season, seasonProgress } from "./core/seasons";
import type { World } from "./core/types";

type Conditions = Pick<World, "tick" | "weather" | "pressure">;
const unit = (v: number) => Math.max(0, Math.min(1, v));

function seasonalFlight(tick: number) {
  const progress = seasonProgress(tick);
  switch (season(tick)) {
    case 0: return unit((progress - 0.12) / 0.18);
    case 1: return 1;
    case 2: return 1 - unit(progress / 0.35);
    case 3: return 0;
  }
}

export function wildlifeTargets(w: Conditions) {
  const light = daylight(w.tick);
  const shelter = isWet(w) || w.weather === "Vent de poussière" || light < 0.34;
  return {
    shelter,
    flight: shelter ? 0 : light * seasonalFlight(w.tick) * unit((70 - w.pressure) / 22),
  };
}

/** View-only transitions follow village time, not wall time or the simulation RNG. */
export class WildlifeRhythm {
  cover = 0;
  flight = 0;
  headingToCover = false;
  private previous?: number;

  update(w: Conditions, time: number, reducedMotion: boolean) {
    const target = wildlifeTargets(w);
    const cover = Number(target.shelter);
    this.headingToCover = target.shelter;
    const jump = this.previous === undefined || time < this.previous || time - this.previous > 4;
    if (jump || reducedMotion) {
      this.cover = cover;
      this.flight = target.flight;
    } else {
      const dt = time - (this.previous ?? time);
      const approach = (v: number, goal: number, speed: number) =>
        v < goal ? Math.min(goal, v + speed * dt) : Math.max(goal, v - speed * dt);
      this.cover = approach(this.cover, cover, 0.34);
      this.flight = approach(this.flight, target.flight, 0.72);
    }
    this.previous = time;
  }
}
