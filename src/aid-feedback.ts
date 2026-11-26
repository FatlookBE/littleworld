import type { Villager, World } from "./core/types";
import type { ResidentAidSupply } from "./core/resident-aid";
import { residentActivityAllowed } from "./resident-actions";

const durationMs = 2200;

export type AidFeedback = { supply: ResidentAidSupply; elapsed: number };

export class AidFeedbacks {
  private world?: World;
  private entries = new Map<
    number,
    { supply: ResidentAidSupply; started: number }
  >();

  show(world: World, id: number, supply: ResidentAidSupply, now: number) {
    this.useWorld(world);
    this.entries.set(id, { supply, started: now });
  }

  update(world: World, now: number) {
    this.useWorld(world);
    for (const [id, entry] of this.entries) {
      if (now - entry.started >= durationMs) this.entries.delete(id);
    }
  }

  forResident(id: number, now: number): AidFeedback | undefined {
    const entry = this.entries.get(id);
    if (entry)
      return {
        supply: entry.supply,
        elapsed: Math.max(0, now - entry.started),
      };
  }

  private useWorld(world: World) {
    if (world === this.world) return;
    this.world = world;
    this.entries.clear();
  }
}

/** Paint the first sip or bite without changing the resident’s route or job. */
export function aidPose(v: Villager, w: World, feedback?: AidFeedback) {
  if (
    !feedback ||
    feedback.elapsed >= 1200 ||
    !residentActivityAllowed(v, w) ||
    v.route.length > 0 ||
    Math.hypot(v.x - v.target[0], v.y - v.target[1]) >= 0.3
  )
    return undefined;
  return {
    activity:
      feedback.supply === "water" ? ("drink" as const) : ("eat" as const),
    elapsed: feedback.elapsed,
  };
}

export function drawAidMarker(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  feedback: AidFeedback,
  reducedMotion: boolean,
) {
  const age = feedback.elapsed;
  const rise = reducedMotion ? 0 : Math.min(1, age / 450) * 4;
  c.save();
  c.translate(x, y - rise);
  c.scale(scale, scale);
  c.globalAlpha = reducedMotion ? 1 : Math.min(1, (durationMs - age) / 420);
  c.fillStyle = "#2a231d";
  c.strokeStyle = "#e6c992";
  c.lineWidth = 0.9;
  c.beginPath();
  c.arc(0, 0, 9, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  if (feedback.supply === "water") {
    c.fillStyle = "#a4d6cf";
    c.moveTo(0, -5.5);
    c.bezierCurveTo(2.1, -1.8, 4.6, 0.3, 3.3, 3);
    c.bezierCurveTo(2.1, 5.1, -2.1, 5.1, -3.3, 3);
    c.bezierCurveTo(-4.6, 0.3, -2.1, -1.8, 0, -5.5);
  } else {
    c.fillStyle = "#e7b471";
    c.ellipse(0, 0, 5, 3.1, -0.38, 0, Math.PI * 2);
  }
  c.fill();
  if (feedback.supply === "food") {
    c.strokeStyle = "#906036";
    c.beginPath();
    c.moveTo(-2.7, -1.8);
    c.lineTo(-0.8, 0.6);
    c.moveTo(0.3, -2.7);
    c.lineTo(2.1, -0.4);
    c.stroke();
  }
  c.restore();
}
