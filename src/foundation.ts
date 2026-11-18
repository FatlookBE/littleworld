import { TurtleDetail } from "./turtle-detail";
import { AnimationAtlas } from "./animation";
import { carrierPose, turtlePose } from "./carrier-animation";
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
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
  private ruinedTurtle = new AnimationAtlas(
    "/assets/turtle-decayed.png",
    4,
    4,
    0,
    false,
    true,
  );
  private ruinedElephants = new AnimationAtlas(
    "/assets/elephant-decayed.png",
    4,
    2,
    0,
    false,
    true,
  );
  ready = false;
  private scratch = document.createElement("canvas");
  /**
   * Draws a sprite through `paint`; when the world is rotting the sprite is
   * rendered off-screen first so that sickly tints, blotches and glowing
   * cracks land only on its own pixels, and the animation is untouched.
   */
  private rotten(
    ctx: CanvasRenderingContext2D,
    box: [number, number, number, number],
    k: number,
    time: number,
    seed: number,
    paint: (c: CanvasRenderingContext2D) => void,
  ) {
    if (k < 0.04) return paint(ctx);
    const dpr = ctx.getTransform().a || 1,
      vw = ctx.canvas.width / dpr,
      vh = ctx.canvas.height / dpr;
    const x0 = Math.max(0, box[0]),
      y0 = Math.max(0, box[1]),
      x1 = Math.min(vw, box[0] + box[2]),
      y1 = Math.min(vh, box[1] + box[3]);
    if (x1 <= x0 || y1 <= y0) return;
    const w = x1 - x0,
      h = y1 - y0;
    const off = this.scratch;
    off.width = Math.ceil(w * dpr);
    off.height = Math.ceil(h * dpr);
    const o = off.getContext("2d");
    if (!o) return paint(ctx);
    o.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
    paint(o);
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.globalCompositeOperation = "source-atop";
    // Sickly wash, thicker toward the feet.
    const wash = o.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, `rgba(70,60,40,${0.12 * k})`);
    wash.addColorStop(1, `rgba(55,85,35,${0.4 * k})`);
    o.fillStyle = wash;
    o.fillRect(0, 0, w, h);
    // Rot blotches.
    for (let i = 0; i < 4 + Math.round(14 * k); i++) {
      const bx = hash(seed + i) * w,
        by = hash(seed + i + 50) * h,
        r = (0.05 + hash(seed + i + 99) * 0.12) * Math.max(w, h);
      const g = o.createRadialGradient(bx, by, 0, bx, by, r);
      const green = i % 3 === 0;
      g.addColorStop(
        0,
        green ? `rgba(95,120,25,${0.7 * k})` : `rgba(12,4,6,${0.85 * k})`,
      );
      g.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = g;
      o.fillRect(bx - r, by - r, r * 2, r * 2);
    }
    // Glowing cracks, pulsing like a bad fever.
    if (k > 0.15) {
      const heat = (k - 0.15) / 0.85,
        pulse = 0.65 + 0.35 * Math.sin(time * 2.6 + seed);
      o.lineCap = "round";
      o.strokeStyle = `rgba(255,${90 + 60 * pulse},30,${(0.55 + 0.45 * heat) * pulse})`;
      o.shadowColor = "rgba(255,70,20,0.9)";
      o.shadowBlur = 14 * dpr;
      for (let i = 0; i < 6 + Math.round(24 * heat); i++) {
        let px = hash(seed * 3 + i) * w,
          py = hash(seed * 3 + i + 70) * h;
        o.lineWidth =
          (1.2 + 2.6 * hash(seed + i + 7)) *
          (0.6 + heat) *
          (Math.max(w, h) / 600);
        o.beginPath();
        o.moveTo(px, py);
        for (let j = 0; j < 6; j++) {
          px += (hash(seed + i * 9 + j) - 0.5) * 0.06 * w;
          py += hash(seed + i * 7 + j + 3) * 0.06 * h;
          o.lineTo(px, py);
        }
        o.stroke();
      }
    }
    // Festering sores, then a feverish red glow once the world is dying.
    for (let i = 0; i < Math.round(10 * k); i++) {
      const sx = hash(seed + i + 200) * w,
        sy = hash(seed + i + 250) * h,
        r = (0.012 + hash(seed + i + 300) * 0.02) * Math.max(w, h);
      const g = o.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(215,205,110,${0.85 * k})`);
      g.addColorStop(0.5, `rgba(130,40,30,${0.7 * k})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = g;
      o.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    if (k > 0.4) {
      o.fillStyle = `rgba(190,20,10,${(k - 0.4) * 0.7 * (0.7 + 0.3 * Math.sin(time * 2 + seed))})`;
      o.fillRect(0, 0, w, h);
    }
    o.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.filter = `saturate(${1 - 0.55 * k}) brightness(${1 - 0.38 * k}) sepia(${0.55 * k}) hue-rotate(${-20 * k}deg) contrast(${1 + 0.25 * k})`;
    ctx.drawImage(off, x0, y0, w, h);
    ctx.restore();
  }
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
    // The shell is registered at its crown, not at the moving flipper tips.
    const blend = Math.max(0, Math.min(1, (decay - 0.48) / 0.36));
    const turtleBlend = this.ruinedTurtle.ready ? blend : 0;
    if (turtleBlend < 1) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, 2 * (1 - turtleBlend));
      this.rotten(
        ctx,
        [cx - 800 * scale, cy + 80 * scale, 1600 * scale, 1500 * scale],
        decay,
        time,
        11,
        (c) => {
          if (
            !this.turtleDetail.draw(
              c,
              turtlePose(time),
              cx,
              cy + 520 * scale,
              1050 * scale,
            )
          )
            this.turtle.draw(
              c,
              0,
              cx,
              cy + 520 * scale,
              1050 * scale,
              false,
              0.22,
            );
        },
      );
      ctx.restore();
    }
    if (turtleBlend > 0) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, 2 * turtleBlend);
      this.ruinedTurtle.draw(
        ctx,
        turtlePose(time),
        cx + 48 * scale,
        cy + 449 * scale,
        1050 * scale,
        false,
        0.12,
      );
      ctx.restore();
    }
    // All four carriers sit behind the rock lip. Taller shoulders enter its
    // underside while the fixed foot anchors remain on the shell dome.
    for (const [id, x, y, height, mirror] of [
      [0, -270, 765, 485, 0],
      [1, 270, 765, 485, 1],
      [2, -145, 855, 510, 0],
      [3, 145, 855, 510, 1],
    ]) {
      const elephantBlend = this.ruinedElephants.ready ? blend : 0;
      if (elephantBlend < 1) {
        ctx.save();
        ctx.globalAlpha *= Math.min(1, 2 * (1 - elephantBlend));
        this.rotten(
          ctx,
          [
            cx + (x - 330) * scale,
            cy + (y - height * 1.05) * scale,
            660 * scale,
            height * 1.25 * scale,
          ],
          decay,
          time,
          20 + id * 13,
          (c) =>
            this.elephants.draw(
              c,
              carrierPose(time, id),
              cx + x * scale,
              cy + y * scale,
              height * scale,
              Boolean(mirror),
              0.83,
            ),
        );
        ctx.restore();
      }
      if (elephantBlend > 0) {
        ctx.save();
        ctx.globalAlpha *= Math.min(1, 2 * elephantBlend);
        this.ruinedElephants.draw(
          ctx,
          carrierPose(time, id),
          cx + x * scale,
          cy + y * scale,
          height * scale,
          Boolean(mirror),
          0.83,
        );
        ctx.restore();
      }
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
