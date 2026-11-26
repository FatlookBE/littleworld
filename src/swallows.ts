import { loadPaintedImage } from "./asset-status";
import type { riverSwallows } from "./swallow-river";

let sheet: HTMLImageElement | undefined;

function flightSheet() {
  if (!sheet) {
    sheet = new Image();
    loadPaintedImage(sheet, "/assets/swallow-flight.webp");
  }
  return sheet.complete && sheet.naturalWidth ? sheet : undefined;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  frame: number,
  span: number,
) {
  const cw = atlas.naturalWidth / 4;
  const ch = atlas.naturalHeight / 2;
  ctx.drawImage(
    atlas,
    (frame % 4) * cw,
    Math.floor(frame / 4) * ch,
    cw,
    ch,
    -span / 2,
    (-span * ch) / cw / 2,
    span,
    (span * ch) / cw,
  );
}

export function drawRiverSwallows(
  ctx: CanvasRenderingContext2D,
  birds: ReturnType<typeof riverSwallows>,
  project: (x: number, y: number, z: number) => [number, number],
  scale: number,
  time: number,
) {
  if (!birds.length) return;
  const atlas = flightSheet();
  if (!atlas) return;
  for (const bird of birds) {
    if (!bird.visibility) continue;
    const position = project(bird.x, bird.y, bird.z);
    const beat = (Math.floor(time * 12) + bird.beat) % 17;
    ctx.save();
    ctx.globalAlpha *= bird.visibility;
    ctx.translate(...position);
    ctx.scale(-1, 1);
    ctx.rotate(-0.16);
    drawFrame(ctx, atlas, beat < 8 ? (beat + 2) % 8 : 2, 30 * scale);
    ctx.restore();
  }
}

// The flock circles the roofs in world space, so panning keeps it over the village.
export function drawSwallows(
  ctx: CanvasRenderingContext2D,
  center: [number, number],
  scale: number,
  time: number,
  visibility: number,
) {
  if (visibility <= 0) return;
  const atlas = flightSheet();
  if (!atlas) return;
  for (let i = 0; i < 4; i++) {
    const angle = time * (0.21 + i * 0.017) + i * 1.63;
    const radius = 152 + 23 * i;
    const dx = radius * Math.cos(angle);
    const dy = 34 * Math.cos(2 * angle + i) - 19 * Math.sin(angle);
    const x = center[0] + scale * (radius * Math.sin(angle) + 25 * i - 35);
    const y =
      center[1] +
      scale * (17 * Math.sin(2 * angle + i) + 19 * Math.cos(angle) - 12 * i);
    // Two full beats return to the outstretched pose for a short glide.
    const beat = (time * (11 + i * 0.8) + i * 3) % (23 + i);
    const frame = beat < 16 ? (Math.floor(beat) + 2) % 8 : 2;
    const span = (34 + 4 * Math.cos(angle)) * scale;
    ctx.save();
    ctx.globalAlpha *= visibility;
    ctx.translate(x, y);
    ctx.scale(dx < 0 ? -1 : 1, 1);
    ctx.rotate(Math.atan2(dy, Math.abs(dx) + 42) * 0.62);
    drawFrame(ctx, atlas, frame, span);
    ctx.restore();
  }
}
