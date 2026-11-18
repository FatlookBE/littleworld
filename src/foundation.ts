import { TurtleDetail } from "./turtle-detail";
import { AnimationAtlas } from "./animation";
import { carrierPose, turtlePose } from "./carrier-animation";
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
  ) {
    if (!this.ready) return false;
    // The shell is registered at its crown, not at the moving flipper tips.
    if (
      !this.turtleDetail.draw(
        ctx,
        turtlePose(time),
        cx,
        cy + 520 * scale,
        1050 * scale,
      )
    ) {
      this.turtle.draw(ctx, 0, cx, cy + 520 * scale, 1050 * scale, false, 0.22);
    }
    // All four carriers sit behind the rock lip. Taller shoulders enter its
    // underside while the fixed foot anchors remain on the shell dome.
    for (const [id, x, y, height, mirror] of [
      [0, -270, 765, 485, 0],
      [1, 270, 765, 485, 1],
      [2, -145, 855, 510, 0],
      [3, 145, 855, 510, 1],
    ]) {
      this.elephants.draw(
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
