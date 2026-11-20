import { YoungResidentAtlases, youthStage } from "./young-residents";
import { loadPaintedImage } from "./asset-status";
import { nutritionStage } from "./core/nutrition";
import { residentAction, residentActionTime } from "./resident-actions";
import { AnimationAtlas, loopFrame } from "./animation";
import { ExtraResidentAtlases } from "./extra-residents";
import type { Villager, World } from "./core/types";
// Source pixels in the user's original 1536×1024 atlas. Anchors are foot positions,
// not cell centers: the sheet has irregular spacing and differently sized poses.
export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  footX: number;
  footY: number;
}
const frame = (
  x: number,
  y: number,
  w: number,
  h: number,
  footX = w / 2,
  footY = h,
): Frame => ({ x, y, w, h, footX, footY });
export const poses = {
  idle: [
    frame(158, 0, 122, 218, 65, 211),
    frame(337, 0, 110, 218, 58, 211),
    frame(502, 0, 86, 218, 47, 211),
    frame(662, 0, 105, 218, 54, 211),
    frame(823, 0, 121, 218, 60, 211),
    frame(1010, 0, 90, 218, 44, 211),
    frame(1155, 0, 106, 218, 50, 211),
    frame(1300, 0, 109, 218, 56, 211),
  ],
  walk: [
    frame(164, 224, 95, 176, 48, 169),
    frame(303, 224, 128, 176, 66, 169),
    frame(457, 224, 130, 176, 66, 169),
    frame(616, 224, 130, 176, 65, 169),
    frame(775, 224, 132, 176, 66, 169),
    frame(943, 224, 111, 176, 53, 169),
    frame(1082, 224, 132, 176, 66, 169),
    frame(1243, 224, 134, 176, 68, 169),
  ],
  fight: [
    frame(111, 410, 133, 170, 65, 164),
    frame(271, 410, 133, 170, 66, 164),
    frame(415, 410, 181, 170, 83, 164),
    frame(621, 410, 118, 170, 59, 164),
    frame(783, 410, 117, 170, 59, 164),
    frame(946, 410, 180, 170, 53, 164),
    frame(1130, 410, 120, 170, 57, 164),
    frame(1295, 410, 137, 170, 68, 164),
  ],
  share: [
    frame(446, 592, 140, 209, 60, 201),
    frame(794, 592, 133, 209, 62, 201),
    frame(1097, 592, 136, 209, 57, 201),
  ],
  tired: [
    frame(109, 806, 137, 218, 67, 208),
    frame(243, 806, 124, 218, 70, 208),
    frame(382, 806, 119, 218, 70, 208),
    frame(517, 806, 113, 218, 65, 208),
    frame(648, 806, 118, 218, 66, 208),
    frame(777, 806, 132, 218, 66, 208),
  ],
  hurt: [
    frame(1051, 806, 108, 218, 64, 208),
    frame(1180, 806, 90, 218, 46, 208),
    frame(1270, 806, 110, 218, 55, 208),
    frame(1430, 806, 106, 218, 53, 208),
  ],
};
export function residentPose(v: Villager, w: World, time: number) {
  const fight = w.disasters?.some(
    (e) => e.kind === "fight" && e.people.includes(v.id),
  );
  const moving = v.route.length > 0 && !fight;
  const target = v.route[0] ?? v.target,
    dx = target[0] - v.x,
    dy = target[1] - v.y;
  const screenX = dx - dy,
    screenY = (dx + dy) * 0.5;
  const animated = !w.settings.reducedMotion;
  const phase = Math.floor(time * (fight ? 7 : 8) + v.id);
  if (fight)
    return {
      frame: poses.fight[animated ? phase % 8 : 0],
      mirror: v.id % 2 === 1,
    };
  if (moving)
    return { frame: poses.walk[animated ? phase % 8 : 0], mirror: screenX < 0 };
  if (v.health < 25)
    return { frame: poses.hurt[v.health < 8 ? 2 : 1], mirror: false };
  if (v.action.includes("repose") || v.morale < 25)
    return {
      frame: poses.tired[Math.min(5, Math.floor((100 - v.morale) / 20))],
      mirror: false,
    };
  if (v.action.includes("pompe") || v.action.includes("voisins"))
    return {
      frame: poses.share[animated ? Math.floor(time * 2 + v.id) % 3 : 0],
      mirror: false,
    };
  const direction =
    Math.abs(screenX) + Math.abs(screenY) < 0.01
      ? v.id % 8
      : (Math.round(Math.atan2(screenY, screenX) / (Math.PI / 4)) + 8) % 8;
  return { frame: poses.idle[direction], mirror: false };
}
export const residentSkin = (id: number) =>
  [2, 4, 1, 0, 1, 5, 3, 2, 3, 4, 1, 2, 1, 5, 3, 0, 1, 4, 1, 0, 1, 5, 3, 2][
    id % 24
  ] ?? 0;
const detailedActivityAtlas = (path: string) =>
  new AnimationAtlas(path, 6, 4, 0, true, true, undefined, true);

export class ResidentAtlas {
  extra = new ExtraResidentAtlases();
  young = new YoungResidentAtlases();
  image: HTMLImageElement;
  activities = {
    bake: detailedActivityAtlas("/assets/residents-bake.png"),
    care: detailedActivityAtlas("/assets/residents-care.png"),
    carry: detailedActivityAtlas("/assets/residents-carry.png"),
    gather: new AnimationAtlas(
      "/assets/residents-gather.png",
      6,
      4,
      0,
      false,
      true,
    ),
    work: new AnimationAtlas(
      "/assets/residents-work.png",
      6,
      4,
      0,
      false,
      true,
    ),
    drink: new AnimationAtlas(
      "/assets/residents-drink.png",
      6,
      4,
      0,
      false,
      true,
    ),
    eat: new AnimationAtlas("/assets/residents-eat.png", 6, 4, 0, false, true),
  };
  gauntWalk = new AnimationAtlas(
    "/assets/residents-gaunt-walk.png",
    8,
    4,
    0,
    false,
    true,
  );
  gauntActivities = {
    bake: detailedActivityAtlas("/assets/residents-gaunt-bake.png"),
    care: detailedActivityAtlas("/assets/residents-gaunt-care.png"),
    carry: detailedActivityAtlas("/assets/residents-gaunt-carry.png"),
    gather: new AnimationAtlas(
      "/assets/residents-gaunt-gather.png",
      6,
      4,
      0,
      false,
      true,
    ),
    work: new AnimationAtlas(
      "/assets/residents-gaunt-work.png",
      6,
      4,
      0,
      false,
      true,
    ),
    drink: new AnimationAtlas(
      "/assets/residents-gaunt-drink.png",
      6,
      4,
      0,
      false,
      true,
    ),
    eat: new AnimationAtlas(
      "/assets/residents-gaunt-eat.png",
      6,
      4,
      0,
      false,
      true,
    ),
  };
  // Authored reaction rows have unequal margins; keep neighbouring hats/feet out.
  gauntReactions = new AnimationAtlas(
    "/assets/residents-gaunt-hit.png",
    4,
    4,
    0,
    true,
    true,
    [0, 265, 537, 793, 1024],
  );
  fightCycle = detailedActivityAtlas("/assets/residents-fight-cycle.png");
  gauntFightCycle = detailedActivityAtlas(
    "/assets/residents-gaunt-fight-cycle.png",
  );
  reactions = new AnimationAtlas("/assets/residents-hit.png", 4, 4);
  variants = new Image();
  walks = new AnimationAtlas("/assets/residents-walk.png", 8, 3, 24);
  variantFrames: Frame[][] = [];
  variantsReady = false;
  ready = false;
  failed = false;
  constructor() {
    this.image = new Image();
    this.image.onload = () => {
      this.ready = true;
    };
    this.image.onerror = () => {
      this.failed = true;
    };
    loadPaintedImage(this.image, "/assets/residents-atlas.png");
    this.variants.onload = () => {
      const image = this.variants,
        c = document.createElement("canvas");
      c.width = image.width;
      c.height = image.height;
      const context = c.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, c.width, c.height).data;
      // Actual alpha bounds keep feet stable even with small generated placement differences.
      for (let row = 0; row < 3; row++) {
        const frames: Frame[] = [];
        for (let col = 0; col < 6; col++) {
          const x0 = Math.floor((col * c.width) / 6),
            x1 = Math.floor(((col + 1) * c.width) / 6),
            y0 = Math.floor((row * c.height) / 3),
            y1 = Math.floor(((row + 1) * c.height) / 3);
          let left = x1,
            top = y1,
            right = x0,
            bottom = y0;
          for (let y = y0; y < y1; y++)
            for (let x = x0; x < x1; x++)
              if (data[(y * c.width + x) * 4 + 3] > 40) {
                left = Math.min(left, x);
                right = Math.max(right, x);
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
              }
          frames.push(
            frame(
              left,
              top,
              right - left + 1,
              bottom - top + 1,
              (right - left + 1) / 2,
              bottom - top + 1,
            ),
          );
        }
        this.variantFrames.push(frames);
      }
      this.variantsReady = true;
    };
    loadPaintedImage(this.variants, "/assets/residents-variants.png");
  }
  draw(
    ctx: CanvasRenderingContext2D,
    v: Villager,
    w: World,
    time: number,
    x: number,
    y: number,
    scale: number,
  ) {
    ctx.save();
    const wear = Math.min(1, (v.malnutrition ?? 0) / 55);
    if (wear > 0)
      ctx.filter = `saturate(${1 - wear * 0.3}) brightness(${1 - wear * 0.08})`;
    const drawn = this.drawBody(ctx, v, w, time, x, y, scale);
    ctx.restore();
    return drawn;
  }
  private drawBody(
    ctx: CanvasRenderingContext2D,
    v: Villager,
    w: World,
    time: number,
    x: number,
    y: number,
    scale: number,
  ) {
    const youth = youthStage(v.age);
    if (youth) return this.young.draw(youth, ctx, v, w, time, x, y, scale);
    const skin = residentSkin(v.id);
    if (skin >= 4) return this.extra.draw(ctx, skin, v, w, time, x, y, scale);
    const gaunt = nutritionStage(v) === 2;
    const reactions =
      gaunt && this.gauntReactions.ready ? this.gauntReactions : this.reactions;
    const hitAge = v.hitAt === undefined ? Infinity : w.tick - v.hitAt;
    if (hitAge >= 0 && hitAge < 4 && reactions.ready) {
      const phase = w.settings.reducedMotion
        ? 1
        : Math.min(3, Math.floor(Math.max(0, time / 0.2 - v.hitAt!)));
      return reactions.draw(
        ctx,
        skin * 4 + phase,
        x,
        y,
        56 * scale,
        v.hitSide === 1,
      );
    }
    const activity = residentAction(v, w);
    const activityAtlas = activity
      ? gaunt
        ? this.gauntActivities[activity]
        : this.activities[activity]
      : null;
    activityAtlas?.load();
    if (activityAtlas?.ready) {
      const moving = v.route.length > 0;
      const target = v.route[0] ?? v.target;
      const phase =
        activity === "carry" && !moving
          ? 0
          : loopFrame(
              residentActionTime(v, time),
              6,
              activity === "carry" ? 7 : 5,
              0,
              w.settings.reducedMotion,
            );
      const authoredFeet =
        activity === "bake" || activity === "care" || activity === "carry";
      return activityAtlas.draw(
        ctx,
        skin * 6 + phase,
        x,
        y,
        (activity === "care" ? 43 : 56) * scale,
        moving ? target[0] - v.x - (target[1] - v.y) < 0 : v.id % 2 === 1,
        authoredFeet ? undefined : 0.93,
      );
    }
    const fighting = w.disasters?.some(
      (e) => e.kind === "fight" && e.people.includes(v.id),
    );
    const fightCycle = gaunt ? this.gauntFightCycle : this.fightCycle;
    if (fighting) fightCycle.load();
    if (fighting && fightCycle.ready) {
      const otherId = w.disasters
        ?.find((e) => e.kind === "fight" && e.people.includes(v.id))
        ?.people.find((id) => id !== v.id);
      const other = w.villagers.find((person) => person.id === otherId);
      return fightCycle.draw(
        ctx,
        skin * 6 +
          loopFrame(time, 6, 5, (v.id % 2) * 3, w.settings.reducedMotion),
        x,
        y,
        56 * scale,
        other ? other.x - v.x - (other.y - v.y) < 0 : v.id % 2 === 1,
      );
    }
    if (gaunt && fighting && this.gauntReactions.ready) {
      return this.gauntReactions.draw(
        ctx,
        skin * 4 + loopFrame(time, 4, 4, v.id, w.settings.reducedMotion),
        x,
        y,
        56 * scale,
        v.id % 2 === 1,
      );
    }
    if (gaunt && !fighting && this.gauntWalk.ready) {
      const moving = v.route.length > 0;
      const target = v.route[0] ?? v.target;
      return this.gauntWalk.draw(
        ctx,
        skin * 8 +
          (moving ? loopFrame(time, 8, 8, v.id, w.settings.reducedMotion) : 0),
        x,
        y,
        56 * scale,
        moving ? target[0] - v.x - (target[1] - v.y) < 0 : v.id % 2 === 1,
        0.93,
      );
    }
    if (skin > 0 && this.variantsReady) {
      const fighting = w.disasters?.some(
          (e) => e.kind === "fight" && e.people.includes(v.id),
        ),
        moving = v.route.length > 0 && !fighting,
        animate = !w.settings.reducedMotion;
      if (moving && this.walks.ready) {
        const target = v.route[0] ?? v.target;
        return this.walks.draw(
          ctx,
          (skin - 1) * 8 + loopFrame(time, 8, 10, v.id, !animate),
          x,
          y,
          56 * scale,
          target[0] - v.x - (target[1] - v.y) < 0,
        );
      }
      const phase = animate ? Math.floor(time * 5 + v.id) % 2 : 0;
      const col = fighting
        ? 3 + phase
        : moving
          ? 1 + phase
          : v.health < 30 || v.morale < 25 || v.action.includes("repose")
            ? 5
            : 0;
      const f = this.variantFrames[skin - 1][col],
        normal = this.variantFrames[skin - 1][0],
        k = (56 * scale) / normal.h;
      const target = v.route[0] ?? v.target,
        mirror = target[0] - v.x - (target[1] - v.y) < 0;
      ctx.save();
      ctx.translate(x, y);
      if (mirror) ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        this.variants,
        f.x,
        f.y,
        f.w,
        f.h,
        -f.footX * k,
        -f.footY * k,
        f.w * k,
        f.h * k,
      );
      ctx.restore();
      return true;
    }
    if (!this.ready) return false;
    const { frame: f, mirror } = residentPose(v, w, time);
    // Idle figures are taller in the supplied art than the action poses.
    const k =
      scale * (poses.walk.includes(f) || poses.fight.includes(f) ? 0.32 : 0.27);
    ctx.save();
    ctx.translate(x, y);
    if (mirror) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      this.image,
      f.x,
      f.y,
      f.w,
      f.h,
      -f.footX * k,
      -f.footY * k,
      f.w * k,
      f.h * k,
    );
    ctx.restore();
    return true;
  }
}
