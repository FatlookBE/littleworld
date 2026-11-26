import { AnimationAtlas, loopFrame } from "./animation";
import { aidPose, type AidFeedback } from "./aid-feedback";
import type { Villager, World } from "./core/types";
import { nutritionStage } from "./core/nutrition";
import { residentAction, residentActionTime } from "./resident-actions";

const gauntOffset = 48;

const activityStarts = {
  gather: 16,
  work: 20,
  drink: 24,
  eat: 28,
  bake: 32,
  care: 36,
  carry: 40,
} as const;

const walkFrames = [1, 2, 6, 3, 4, 7, 5];
const fightFrames = [8, 9, 10, 11];
const hitFrames = [12, 13, 13, 0];

export function extraResidentPose(v: Villager, w: World, time: number, feedback?: AidFeedback) {
  const animated = !w.settings.reducedMotion;
  const gaunt = nutritionStage(v) === 2;
  const offset = gaunt ? gauntOffset : 0;
  const target = v.route[0] ?? v.target;
  const left = target[0] - v.x - (target[1] - v.y) < 0;
  const at = (frame: number, mirror = left) => ({ frame, mirror });
  const struckAt = v.hitAt ?? -Infinity;
  const hitAge = w.tick - struckAt;
  if (hitAge >= 0 && hitAge < 4) {
    const phase = animated
      ? Math.max(0, Math.min(3, Math.floor(time / 0.2 - struckAt)))
      : 0;
    return at(offset + hitFrames[phase], v.hitSide === 1);
  }

  const fight = w.disasters?.find(
    (event) => event.kind === "fight" && event.people.includes(v.id),
  );
  if (fight) {
    const opponent = w.villagers.find(
      (person) => person.id !== v.id && fight.people.includes(person.id),
    );
    const mirror = opponent
      ? opponent.x - v.x - (opponent.y - v.y) < 0
      : v.id % 2 === 1;
    const phase = loopFrame(
      time,
      fightFrames.length,
      5,
      (v.id % 2) * 2,
      !animated,
    );
    return at(offset + fightFrames[phase], mirror);
  }

  const gift = aidPose(v, w, feedback);
  if (gift) {
    const phase = animated ? Math.min(3, Math.floor(gift.elapsed / 300)) : 1;
    return at(offset + activityStarts[gift.activity] + phase, v.id % 2 === 1);
  }
  const activity = residentAction(v, w);
  if (activity) {
    const moving = v.route.length > 0;
    const carrying = activity === "carry";
    const phase =
      carrying && !moving
        ? 0
        : loopFrame(
            residentActionTime(v, time),
            4,
            carrying ? 8 : 5,
            0,
            !animated,
          );
    return at(
      offset + activityStarts[activity] + phase,
      moving ? left : v.id % 2 === 1,
    );
  }

  if (v.route.length > 0) {
    const phase = loopFrame(
      time,
      walkFrames.length,
      gaunt ? 7 : 9,
      v.id,
      !animated,
    );
    return at(offset + walkFrames[phase]);
  }
  if (v.health < 8) return at(offset + 15);
  if (v.health < 25) return at(offset + 13);
  if (v.morale < 25 || v.action.includes("repose")) return at(offset + 14);
  return at(offset);
}

export class ExtraResidentAtlases {
  private readonly sheets = [
    new AnimationAtlas("/assets/resident-saffron.webp", 8, 12, 0, false, true),
    new AnimationAtlas("/assets/resident-moss.webp", 8, 12, 0, false, true),
  ];

  draw(
    ctx: CanvasRenderingContext2D,
    skin: number,
    v: Villager,
    w: World,
    time: number,
    x: number,
    y: number,
    scale: number,
    feedback?: AidFeedback,
  ) {
    const sheet = this.sheets[skin - 4];
    if (!sheet?.ready) return false;
    const { frame, mirror } = extraResidentPose(v, w, time, feedback);
    return sheet.draw(ctx, frame, x, y, 63 * scale, mirror);
  }

  drawRemains(
    ctx: CanvasRenderingContext2D,
    skin: number,
    resident: Villager,
    stage: number,
    x: number,
    y: number,
    scale: number,
  ) {
    const offset = nutritionStage(resident) === 2 ? gauntOffset : 0;
    return (
      this.sheets[skin - 4]?.draw(ctx, 44 + offset + stage, x, y, 54 * scale) ??
      false
    );
  }
}
