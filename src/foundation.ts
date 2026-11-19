import {
  decayTransition,
  paintDecayTransition,
  type DecayTransition,
} from "./decay-transition";
import { TurtleDetail } from "./turtle-detail";
import { AnimationAtlas } from "./animation";
import { carrierPose, turtlePose } from "./carrier-animation";
/**
 * How rotten the world looks, 0 (healthy) to 1 (agonising): mostly the
 * pressure, worsened by thirst, hunger and the dead.
 */
export const decayOf = (w: {
  pressure: number;
  water: number;
  food: number;
  villagers: { dead: boolean }[];
}) => {
  const dead = w.villagers.filter((v) => v.dead).length / w.villagers.length;
  const lack = (200 - w.water - w.food) / 200;
  return Math.max(
    0,
    Math.min(1, (w.pressure / 100) * 0.7 + lack * 0.15 + dead * 0.15),
  );
};
/** Four distinct painted stages, driven by the same scarcity as the village. */
export const turtleStage = (decay: number) =>
  decay >= 0.78 ? 3 : decay >= 0.48 ? 2 : decay >= 0.22 ? 1 : 0;

/** Individually animated painted carriers. Every pose uses a constant scale and anchor. */
export class WorldFoundation {
  image = new Image();
  turtleDetail = new TurtleDetail();
  elephants = new AnimationAtlas(
    "/assets/elephant-cycle.png",
    4,
    2,
    0,
    false,
    true,
  );
  turtle = new AnimationAtlas("/assets/turtle-swim.png", 4, 4, 0, false, true);
  private turtleStages = [
    this.turtleDetail,
    new TurtleDetail("withered"),
    new TurtleDetail("ruined"),
    new TurtleDetail("horror"),
  ];
  private elephantStages = [
    this.elephants,
    ...["withered", "ruined", "horror"].map(
      (stage) =>
        new AnimationAtlas(
          `/assets/elephant-${stage}-cycle.png`,
          4,
          2,
          0,
          false,
          true,
        ),
    ),
  ];
  activeStage = 0;
  activeTransition: DecayTransition = { from: 0, to: 0, progress: 0 };
  private slabs = [this.image];
  private slabReady = [false, false, false, false];
  ready = false;
  constructor() {
    this.image.onload = () => {
      this.ready = true;
      this.slabReady[0] = true;
    };
    ["withered", "ruined", "horror"].forEach((name, i) => {
      const image = new Image();
      this.slabs.push(image);
      image.onload = () => {
        this.slabReady[i + 1] = true;
      };
      image.src = `/assets/world-slab-${name}.png`;
    });
    this.image.src = "/assets/world-slab.png";
  }
  draw(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    time = 0,
    decay = 0,
    terrainReady: readonly boolean[] = [true, true, true, true],
    reduced = false,
  ) {
    if (!this.ready) return false;
    const available = this.turtleStages.map(
      (atlas, stage) =>
        atlas.ready &&
        this.elephantStages[stage].ready &&
        this.slabReady[stage] &&
        terrainReady[stage],
    );
    this.activeTransition = decayTransition(decay, available, reduced);
    this.activeStage = this.activeTransition.from;
    paintDecayTransition(ctx, this.activeTransition, [cx, cy], scale, (stage) =>
      this.drawStage(ctx, cx, cy, scale, time, stage),
    );
    return true;
  }
  private drawStage(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    time: number,
    stage: number,
  ) {
    const pose = turtlePose(time);
    const turtle = this.turtleStages[stage];
    if (!turtle.draw(ctx, pose, cx, cy + 520 * scale, 1050 * scale))
      this.turtle.draw(
        ctx,
        pose,
        cx,
        cy + 520 * scale,
        1050 * scale,
        false,
        0.22,
      );
    // All four carriers sit behind the rock lip. Taller shoulders enter its
    // underside while the fixed foot anchors remain on the shell dome.
    for (const [id, x, y, height, mirror] of [
      [0, -270, 765, 485, 0],
      [1, 270, 765, 485, 1],
      [2, -145, 855, 510, 0],
      [3, 145, 855, 510, 1],
    ]) {
      // All carriers share the turtle's degradation stage and fixed appuis.
      const atlas = this.elephantStages[stage];
      atlas.draw(
        ctx,
        carrierPose(time, id),
        cx + x * scale,
        cy + y * scale,
        height * scale,
        Boolean(mirror),
        0.83,
      );
    }
    // Register each continuous cliff face to the isometric rim. A horizontal
    // crop would change the strata's slope halfway down the same face.
    const half = 29 * 23 * scale;
    const front = cy + half * 0.5;
    const depthScale = (180 * scale) / 354;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - half - 2, cy - 2);
    ctx.lineTo(cx, front - 2);
    ctx.lineTo(cx + half + 2, cy - 2);
    ctx.lineTo(cx + half + 20 * scale, cy + 1500 * scale);
    ctx.lineTo(cx - half - 20 * scale, cy + 1500 * scale);
    ctx.closePath();
    ctx.clip();
    for (const side of [-1, 1]) {
      const sourceSpan = side < 0 ? 734 : 732;
      const horizontalScale = half / sourceSpan;
      const shear = (-side * (half * 0.5 - 250 * depthScale)) / sourceSpan;
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        side < 0 ? cx - half - 20 * scale : cx,
        cy - 2,
        half + 20 * scale,
        1500 * scale,
      );
      ctx.clip();
      ctx.transform(
        horizontalScale,
        shear,
        0,
        depthScale,
        cx - 768 * horizontalScale,
        front - 670 * depthScale - 768 * shear,
      );
      ctx.drawImage(this.slabs[stage], 0, 0);
      ctx.restore();
    }
    ctx.restore();
    return true;
  }
}
