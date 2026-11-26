import { drawPaintedProp } from "./painted-props";

export function drawRainBuckets(
  c: CanvasRenderingContext2D,
  screen: [number, number],
  scale: number,
  ready: boolean,
) {
  c.save();
  c.translate(...screen);
  c.scale(scale, scale);
  for (const { x, ground, size } of [
    { x: -6, ground: 2, size: 19 },
    { x: 5, ground: 4, size: 14 },
  ]) {
    const painted = drawPaintedProp(c, "bucket", x, ground, size);
    if (!painted) {
      c.lineWidth = 1;
      c.fillStyle = "#806a55";
      c.strokeStyle = "#3d3429";
      c.beginPath();
      c.moveTo(x - 4, ground - 8);
      c.lineTo(x - 3, ground - 2);
      c.quadraticCurveTo(x, ground, x + 3, ground - 2);
      c.lineTo(x + 4, ground - 8);
      c.closePath();
      c.fill();
      c.stroke();
    }
    if (ready) {
      if (painted) {
        c.fillStyle = "#9ac9c9";
        c.fillRect(x + 2, ground - size * 0.53, 1.4, 1.2);
      } else {
        c.fillStyle = "#839f9b";
        c.beginPath();
        c.ellipse(x, ground - 8, 3.5, 1.4, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  c.restore();
}
