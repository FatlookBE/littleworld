import { drawPaintedProp } from "./painted-props";

export function drawMarketStock(
  c: CanvasRenderingContext2D,
  [x, y]: [number, number],
  scale: number,
  stock: "water" | "food",
) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  c.beginPath();
  c.ellipse(0, 1, 21, 4, 0, 0, Math.PI * 2);
  c.fillStyle = "#231a185d";
  c.fill();
  if (!drawPaintedProp(c, "sawhorse", 0, 2, 39)) {
    c.fillStyle = "#806447";
    c.fillRect(-12, -9, 25, 3);
    for (const u of [-9, 8]) c.fillRect(u, -6, 3, 7);
  }
  if (stock === "food") {
    if (!drawPaintedProp(c, "loaves", -3, -10, 27)) {
      c.fillStyle = "#c5a46b";
      c.fillRect(-12, -14, 14, 4);
    }
    drawPaintedProp(c, "seedSack", 12, 3, 20);
  } else {
    if (!drawPaintedProp(c, "bucket", -5, -8, 24)) {
      c.fillStyle = "#779995";
      c.fillRect(-11, -16, 11, 8);
    }
    drawPaintedProp(c, "bucket", 11, -8, 19);
  }
  c.restore();
}
