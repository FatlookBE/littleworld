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
  private ruinedTurtle = new TurtleDetail("ruined");
  private ruinedElephants = new AnimationAtlas(
    "/assets/elephant-ruined.webp",
    4,
    2,
    0,
    false,
    true,
  );
  ready = false;
  constructor() {
    this.image.onload = () => {
      this.ready = true;
    };
    this.image.src = "/assets/world-slab.png";
  }
  draw(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    time = 0,
    decay = 0,
  ) {
    if (!this.ready) return false;
    const pose = turtlePose(time);
    const turtle =
      decay >= 0.36 && this.ruinedTurtle.ready
        ? this.ruinedTurtle
        : this.turtleDetail;
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
      // Stagger the herd's transformation, showing one painted pose per animal.
      const atlas =
        decay >= 0.12 + id * 0.14 && this.ruinedElephants.ready
          ? this.ruinedElephants
          : this.elephants;
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
      ctx.drawImage(this.image, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    return true;
  }
}
