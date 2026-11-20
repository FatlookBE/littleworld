import { AnimationAtlas, loopFrame } from "./animation";
import type { Villager, World } from "./core/types";

export function youthStage(age: number) {
  if (age < 3) return "baby";
  if (age < 12) return "child";
  if (age < 18) return "teen";
  return null;
}

export function youthFrame(v: Villager, w: World, time: number) {
  const reduced = w.settings.reducedMotion;
  if (v.health < 30 || v.action.includes("repose")) return 15;
  if (v.route.length || v.action === "Rampe au seuil") {
    return loopFrame(time, 8, v.age < 3 ? 5 : 8, v.id, reduced);
  }
  if (v.action.startsWith("Joue"))
    return 8 + loopFrame(time, 6, 5, v.id, reduced);
  return 14;
}

export class YoungResidentAtlases {
  private sheets = {
    baby: new AnimationAtlas(
      "/assets/youth-baby.webp",
      8,
      2,
      0,
      false,
      true,
      undefined,
      true,
    ),
    child: new AnimationAtlas(
      "/assets/youth-child.webp",
      8,
      2,
      0,
      false,
      true,
      undefined,
      true,
    ),
    teen: new AnimationAtlas(
      "/assets/youth-teen.webp",
      8,
      2,
      0,
      false,
      true,
      undefined,
      true,
    ),
  };

  draw(
    stage: keyof YoungResidentAtlases["sheets"],
    ctx: CanvasRenderingContext2D,
    v: Villager,
    w: World,
    time: number,
    x: number,
    y: number,
    scale: number,
  ) {
    const sheet = this.sheets[stage];
    sheet.load();
    const target = v.route[0] ?? v.target;
    const left = target[0] - v.x - (target[1] - v.y) < 0;
    const frame = youthFrame(v, w, time);
    const lift =
      stage === "child" && frame >= 8 && frame <= 13
        ? [0, 1, 6, 9, 3, 0][frame - 8] * scale
        : 0;
    return sheet.draw(ctx, frame, x, y - lift, 56 * scale, left);
  }
}
