import { loadPaintedImage } from "./asset-status";
/**
 * Small ambient creatures living in the void around the world: glowing
 * jellyfish below the turtle, a tiny whale that crosses now and then, and
 * shooting stars. Purely decorative, deterministic from time, drawn behind
 * the world. Skipped entirely when reduced motion is requested.
 */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const faunaColumns = 3;
const faunaRows = 2;
const jellyfishFrames = [0, 1, 2, 3, 4, 5];
const whaleFrames = [0, 1, 2, 3, 4, 5, 2, 1];

let fauna: { jellyfish: HTMLImageElement; whale: HTMLImageElement } | undefined;

function loadFauna() {
  const jellyfish = new Image();
  const whale = new Image();
  loadPaintedImage(jellyfish, "/assets/void-jellyfish.webp");
  loadPaintedImage(whale, "/assets/void-whale.webp");
  return { jellyfish, whale };
}

function drawFaunaFrame(
  c: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  frame: number,
  x: number,
  y: number,
  width: number,
) {
  if (!sheet.complete || !sheet.naturalWidth) return;
  const cellWidth = sheet.naturalWidth / faunaColumns;
  const cellHeight = sheet.naturalHeight / faunaRows;
  c.drawImage(
    sheet,
    (frame % faunaColumns) * cellWidth,
    Math.floor(frame / faunaColumns) * cellHeight,
    cellWidth,
    cellHeight,
    x,
    y,
    width,
    (width * cellHeight) / cellWidth,
  );
}

function jellyfish(
  c: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  x: number,
  y: number,
  r: number,
  phase: number,
  hue: number,
) {
  if (!sheet.complete || !sheet.naturalWidth) return;
  const glow = c.createRadialGradient(x, y, 0, x, y, r * 2.6);
  glow.addColorStop(0, `hsla(${hue},75%,66%,0.18)`);
  glow.addColorStop(1, `hsla(${hue},75%,66%,0)`);
  c.fillStyle = glow;
  c.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
  const frame = jellyfishFrames[Math.floor(phase) % jellyfishFrames.length];
  drawFaunaFrame(c, sheet, frame, x - r * 1.25, y - r * 0.8, r * 2.5);
}

function whale(
  c: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  time: number,
  dir: 1 | -1,
) {
  c.save();
  c.translate(x, y + Math.sin(time * 1.4) * width * 0.04);
  c.scale(dir, 1);
  const frame = whaleFrames[Math.floor(time * 7) % whaleFrames.length];
  drawFaunaFrame(c, sheet, frame, -width / 2, -width * 0.3, width);
  c.restore();
}

export function drawCritters(
  c: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  scale: number,
) {
  fauna ??= loadFauna();
  // Jellyfish drifting in slow ellipses around the lower half of the turtle.
  for (let i = 0; i < 6; i++) {
    const a = time * (0.1 + hash(i) * 0.07) + i * 1.9,
      side = i % 2 ? 1 : -1;
    const x = cx + side * (620 + hash(i + 9) * 300 + Math.cos(a) * 60) * scale;
    const y = cy + (300 + hash(i + 3) * 700 + Math.sin(a * 1.3) * 50) * scale;
    jellyfish(
      c,
      fauna.jellyfish,
      x,
      y,
      (22 + hash(i + 5) * 16) * scale,
      time * (5 + hash(i + 14)) + i,
      170 + i * 38,
    );
  }
  // A tiny whale swims across every 48 seconds.
  const cycle = 48,
    k = (time % cycle) / 16;
  if (k < 1) {
    const dir = Math.floor(time / cycle) % 2 ? -1 : 1;
    const whaleWidth = 138 * scale;
    const margin = whaleWidth / 2;
    const distance = k * (width + 2 * margin);
    const x = dir === 1 ? distance - margin : width + margin - distance;
    whale(
      c,
      fauna.whale,
      x,
      cy + (380 + hash(Math.floor(time / cycle)) * 160) * scale,
      whaleWidth,
      time,
      dir,
    );
  }
  // Shooting star every 13 seconds.
  const q = (time % 13) / 1.1;
  if (q < 1) {
    const n = Math.floor(time / 13),
      sx = hash(n) * width * 0.9,
      sy = hash(n + 1) * height * 0.35,
      x = sx + q * 260,
      y = sy + q * 130;
    const g = c.createLinearGradient(x, y, x - 90, y - 45);
    g.addColorStop(0, `rgba(255,244,214,${1 - q})`);
    g.addColorStop(1, "rgba(255,244,214,0)");
    c.strokeStyle = g;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - 90, y - 45);
    c.stroke();
  }
}
