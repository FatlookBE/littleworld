import { residentScale } from "./core/population";
import { buildingDamageStage, type EnvironmentAtlas } from "./environment";
import type { ResidentAtlas } from "./sprites";
import type { Building, Villager, World } from "./core/types";
import { doorOpening } from "./core/home-visits";

// Door leaves in the authored intact/damaged home drawings (source pixels).
const doors = [
  { x: 219, y: 197, w: 39, h: 91 },
  { x: 220, y: 208, w: 42, h: 98 },
  { x: 230, y: 573, w: 39, h: 88 },
  { x: 218, y: 888, w: 39, h: 81 },
];
function arch(x: number, y: number, width: number, height: number) {
  const p = new Path2D();
  p.moveTo(x, y + height);
  p.lineTo(x, y + width * 0.6);
  p.quadraticCurveTo(
    x + width * 0.5,
    y - width * 0.5,
    x + width,
    y + width * 0.6,
  );
  p.lineTo(x + width, y + height);
  p.closePath();
  return p;
}
/** Swing the actual painted leaf around its hinge; never replace it by a flat icon. */
export function drawHouseDoor(
  ctx: CanvasRenderingContext2D,
  w: World,
  b: Building,
  atlas: EnvironmentAtlas,
  frame: number,
  residents: ResidentAtlas,
  sx: number,
  base: number,
  width: number,
  tick: number,
  scale: number,
) {
  const visitor = w.villagers.find(
    (v) =>
      !v.dead &&
      v.visit?.building === b.id &&
      ["entering", "exiting"].includes(v.visit.phase),
  );
  if (!visitor?.visit) return null;
  const source =
    doors[
      atlas.image.src.includes("buildings-damaged")
        ? buildingDamageStage(b.condition)
        : 0
    ];
  const f = atlas.frames[frame];
  if (!f) return null;
  const k = width / f.w;
  const x = sx - width / 2 + (source.x - f.x) * k;
  const y = base - f.h * k + (source.y - f.y) * k;
  const dw = source.w * k,
    dh = source.h * k;
  const age = Math.max(0, Math.min(9, tick - visitor.visit.since));
  const open = w.settings.reducedMotion
    ? age >= 3 && age < 6
      ? 1
      : 0
    : doorOpening(age);
  const opening = arch(x, y, dw, dh);
  if (open > 0) {
    ctx.save();
    ctx.clip(opening);
    const shadow = ctx.createLinearGradient(x, y, x + dw, y + dh);
    shadow.addColorStop(0, "#0b0d0c");
    shadow.addColorStop(1, "#34251a");
    ctx.fillStyle = shadow;
    ctx.fillRect(x - 1, y - dw, dw + 2, dh + dw + 1);
    ctx.restore();
  }
  const entering = visitor.visit.phase === "entering";
  const crossing = Math.max(0, Math.min(1, (age - 3) / 3));
  const depth = entering ? crossing : 1 - crossing;
  const visible = entering ? age < 6 : age >= 3;
  if (visible) {
    const clip = arch(x, y, dw, dh);
    clip.rect(
      x - 100 * scale,
      y + dh - (1 - depth) * 56 * scale,
      200 * scale,
      156 * scale,
    );
    const footX = x + dw * 0.5 + (1 - depth) * 6 * scale;
    const footY = y + dh + (1 - depth) * 25 * scale - depth * 5 * scale;
    const walking: Villager = {
      ...visitor,
      action: entering ? "Entre dans la maison" : "Sort de la maison",
      route: [[visitor.x + (entering ? -1 : 1), visitor.y]],
      target: [visitor.x + (entering ? -1 : 1), visitor.y],
    };
    ctx.save();
    ctx.clip(clip);
    residents.draw(
      ctx,
      walking,
      w,
      tick * 0.2,
      footX,
      footY,
      scale * residentScale(visitor),
    );
    ctx.restore();
  }
  // The leaf stays in front of the threshold and narrows in perspective as it
  // rotates. The curved silhouette, grain and hinges come from the source art.
  if (open > 0) {
    const angle = open * 1.35;
    ctx.save();
    ctx.translate(x, y);
    ctx.transform(Math.cos(angle), Math.sin(angle) * 0.15, 0, 1, 0, 0);
    ctx.clip(arch(0, 0, dw, dh));
    ctx.drawImage(
      atlas.image,
      source.x,
      source.y,
      source.w,
      source.h,
      0,
      0,
      dw,
      dh,
    );
    ctx.restore();
  }
  return visible
    ? {
        id: visitor.id,
        x: x + dw / 2,
        y: y + dh,
        bounds: {
          left: x - 12 * scale,
          right: x + dw + 12 * scale,
          top: y - 20 * scale,
          bottom: y + dh + 28 * scale,
        },
      }
    : null;
}
