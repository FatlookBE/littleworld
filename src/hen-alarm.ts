import { loopFrame } from "./animation";
import type { World } from "./core/types";
import type { villageHens } from "./hens";
import { field } from "./village-layout";

const refuges = {
  north: [12.65, 19.7],
  south: [12.65, 25.9],
} as const;
type Refuge = keyof typeof refuges;
type Hens = ReturnType<typeof villageHens>;

export function fieldAlarm(w: Pick<World, "disasters">) {
  const threats = w.disasters?.filter(
    (e) =>
      e.life > 0 &&
      (e.kind === "fire" || e.kind === "monster") &&
      Math.hypot(
        Math.max(field.x - e.x, e.x - field.x - field.width, 0),
        Math.max(field.y - e.y, e.y - field.y - field.height, 0),
      ) < 2.8,
  );
  if (!threats?.length) return null;
  const clearance = (side: Refuge) =>
    Math.min(
      ...threats.map((e) =>
        Math.hypot(e.x - refuges[side][0], e.y - refuges[side][1]),
      ),
    );
  return {
    refuge: clearance("north") >= clearance("south") ? "north" : "south",
    label: threats.some((e) => e.kind === "fire")
      ? "Les poules s’écartent de la fumée et se regroupent en bordure du champ."
      : "Les poules se regroupent en bordure du champ, loin de la créature.",
  } as const;
}

/** A visual response to world events, without spending simulation RNG or resources. */
export class HenAlarm {
  private refuge: Refuge = "north";
  private blend = 0;
  private previous?: number;

  place(
    hens: Hens,
    alarm: ReturnType<typeof fieldAlarm>,
    time: number,
    reducedMotion: boolean,
  ) {
    const jump =
      this.previous === undefined ||
      time < this.previous ||
      time - this.previous > 4;
    const dt = Math.max(0, time - (this.previous ?? time));
    this.previous = time;
    if (alarm) this.refuge = alarm.refuge;

    if (jump || reducedMotion) this.blend = Number(Boolean(alarm));
    else if (alarm) this.blend = Math.min(1, this.blend + dt * 0.8);
    else this.blend = Math.max(0, this.blend - dt * 0.33);
    if (!this.blend) return hens;

    const [cx, cy] = refuges[this.refuge];
    return hens.map((hen, i) => {
      const x = cx + (i % 2) * 0.55;
      const y = cy + Math.floor(i / 2) * 0.55;
      const progress = Math.max(0, (this.blend - i * 0.09) / (1 - i * 0.09));
      if (!progress) return hen;
      const toward = x - hen.x < y - hen.y;
      return {
        ...hen,
        x: hen.x + (x - hen.x) * progress,
        y: hen.y + (y - hen.y) * progress,
        mirror: progress === 1 ? i % 2 === 0 : toward === Boolean(alarm),
        frame: reducedMotion || progress === 1 ? 0 : loopFrame(time, 4, 14, i),
      };
    });
  }
}
