import { loadPaintedImage } from "./asset-status";

let sheet: HTMLImageElement | undefined;

// The flock circles the roofs in world space, so panning keeps it over the village.
export function drawSwallows(
  ctx: CanvasRenderingContext2D,
  center: [number, number],
  scale: number,
  time: number,
  visibility: number,
) {
  if (visibility <= 0) return;
  if (!sheet) {
    sheet = new Image();
    loadPaintedImage(sheet, "/assets/swallow-flight.webp");
  }
  if (!sheet.complete || !sheet.naturalWidth) return;
  const cw = sheet.naturalWidth / 4;
  const ch = sheet.naturalHeight / 2;
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
    ctx.drawImage(
      sheet,
      (frame % 4) * cw,
      Math.floor(frame / 4) * ch,
      cw,
      ch,
      -span / 2,
      (-span * ch) / cw / 2,
      span,
      (span * ch) / cw,
    );
    ctx.restore();
  }
}
