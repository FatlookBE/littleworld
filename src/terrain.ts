import { drawRiver } from "./water";
import { autumnColour, snowCover } from "./core/seasons";
import type { World } from "./core/types";
/** Continuous material fields: no square tile borders across the painted island. */
export class PaintedTerrain {
  image = new Image();
  materials: HTMLCanvasElement[] = [];
  ready = false;
  private stageMaterials: HTMLCanvasElement[][] = [this.materials];
  constructor() {
    ["materials", "withered", "ruined", "horror"].forEach((name, stage) => {
      const image = stage === 0 ? this.image : new Image();
      image.onload = () => {
        const cells: HTMLCanvasElement[] = [];
        for (let i = 0; i < 4; i++) {
          const c = document.createElement("canvas");
          c.width = c.height = 512;
          c.getContext("2d")!.drawImage(
            image,
            ((i % 2) * image.width) / 2,
            (Math.floor(i / 2) * image.height) / 2,
            image.width / 2,
            image.height / 2,
            0,
            0,
            512,
            512,
          );
          cells.push(c);
        }
        this.stageMaterials[stage] = cells;
        if (stage === 0) {
          this.materials = cells;
          this.ready = true;
        }
      };
      image.src = `/assets/terrain-${name}.png`;
    });
  }
  draw(
    ctx: CanvasRenderingContext2D,
    w: World,
    origin: [number, number],
    scale: number,
    water: { level: number; wet: number },
    time: number,
    stage = 0,
  ) {
    if (!this.ready) return false;
    while (stage > 0 && !this.stageMaterials[stage]) stage--;
    const materials = this.stageMaterials[stage];
    ctx.save();
    ctx.transform(
      23 * scale,
      11.5 * scale,
      -23 * scale,
      11.5 * scale,
      ...origin,
    );
    ctx.beginPath();
    ctx.rect(0, 0, 29, 29);
    ctx.clip();
    const material = (i: number, size = 8) => {
      const p = ctx.createPattern(materials[i], "repeat")!;
      p.setTransform(new DOMMatrix().scale(size / 512));
      return p;
    };
    ctx.fillStyle = material(0);
    ctx.fillRect(0, 0, 29, 29);
    ctx.globalAlpha = Math.max(0, Math.min(1, 1 - w.vegetation / 100));
    ctx.fillStyle = material(1);
    ctx.fillRect(0, 0, 29, 29);
    const autumn = autumnColour(w.tick),
      snow = snowCover(w.tick) * (stage >= 2 ? 0.15 : 1);
    if (autumn > 0) {
      // Fallen leaves warm the grass.
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = 0.45 * autumn;
      ctx.fillStyle = "#c0782e";
      ctx.fillRect(0, 0, 29, 29);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;
    const river = new Path2D();
    for (let y = -1; y <= 30; y += 0.2) {
      const x = 3.7 + Math.sin(y * 0.24) * 1.6;
      if (y === -1) river.moveTo(x, y);
      else river.lineTo(x, y);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Soft, grassy-to-silt banks instead of a ruled border.
    for (const [width, colour] of [
      [4.4, "#3f3a2618"],
      [4.0, "#5a503330"],
      [3.7, "#6a5c3c50"],
    ] as const) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.stroke(river);
    }
    ctx.strokeStyle = material(1, 5);
    ctx.lineWidth = 3.35;
    ctx.stroke(river);
    // The deeper bed stays darker once uncovered, fading up the banks.
    ctx.strokeStyle = "#4a3c291c";
    for (const width of [3.2, 2.8, 2.4, 2.0]) {
      ctx.lineWidth = width;
      ctx.stroke(river);
    }
    // Exposed silt and branching cracks remain as the water retreats.
    for (let y = 0.3; y < 29; y += 0.65) {
      const x = 3.7 + Math.sin(y * 0.24) * 1.6;
      ctx.strokeStyle = "#59473588";
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(x - 1.4, y - 0.2);
      ctx.lineTo(x - 0.7, y + 0.08);
      ctx.lineTo(x + 0.2, y - 0.12);
      ctx.lineTo(x + 1.4, y + 0.25);
      ctx.moveTo(x - 0.7, y + 0.08);
      ctx.lineTo(x - 0.45, y + 0.43);
      ctx.stroke();
    }
    const snowLayer = (alpha: number, paint: () => void) => {
      ctx.save();
      ctx.filter = "grayscale(1) brightness(2.1) contrast(0.7)";
      ctx.globalAlpha = alpha * snow;
      ctx.fillStyle = ctx.strokeStyle = material(1, 6);
      paint();
      ctx.restore();
    };
    if (snow > 0) {
      // Snow takes the texture of the ground beneath it, bleached and patchy.
      snowLayer(0.72, () => ctx.fillRect(0, 0, 29, 29));
      ctx.fillStyle = "#4a5a52";
      for (let i = 0; i < 160; i++) {
        const n = Math.sin(i * 127.1) * 43758.5453,
          m = Math.sin(i * 311.7) * 43758.5453;
        if ((n - Math.floor(n)) * 0.9 > snow - 0.1) continue;
        ctx.globalAlpha = 0.25 * snow;
        ctx.beginPath();
        ctx.ellipse(
          (n - Math.floor(n)) * 29,
          (m - Math.floor(m)) * 29,
          0.25 + (m - Math.floor(m)) * 0.4,
          0.15 + (n - Math.floor(n)) * 0.25,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawRiver(
      ctx,
      water.level,
      water.wet,
      time,
      materials[3],
      w.weather === "Pluie légère",
      snow,
    );
    const road = new Path2D();
    road.moveTo(4, 15);
    road.bezierCurveTo(9, 14.7, 19, 15.3, 28, 15);
    road.moveTo(13, 7.5);
    road.bezierCurveTo(12.7, 11, 13.2, 16, 13, 20);
    road.moveTo(7.5, 10);
    road.bezierCurveTo(12, 9.8, 17, 10.2, 22, 10);
    ctx.strokeStyle = "#66553a66";
    ctx.lineWidth = 1.1;
    ctx.stroke(road);
    ctx.strokeStyle = material(2, 5);
    ctx.lineWidth = 0.72;
    ctx.stroke(road);
    ctx.fillStyle = material(1, 5);
    ctx.fillRect(5, 19, 6, 5);
    for (let row = 0; row < 9; row++) {
      ctx.strokeStyle = "#4f3b2799";
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(5.2, 19.3 + row * 0.53);
      ctx.lineTo(10.8, 19.3 + row * 0.53);
      ctx.stroke();
      for (let col = 0; col < 14; col++) {
        const x = 5.3 + col * 0.4,
          y = 19.3 + row * 0.53;
        ctx.strokeStyle =
          stage >= 2
            ? "#65574d"
            : w.vegetation > 40 && stage === 0
              ? "#76813f"
              : "#9d8046";
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(x - 0.1, y + 0.08);
        ctx.lineTo(x, y - 0.18);
        ctx.lineTo(x + 0.12, y + 0.02);
        ctx.stroke();
      }
    }
    if (snow > 0) {
      // Trodden paths stay partly visible; the field disappears under snow.
      snowLayer(0.45, () => {
        ctx.lineWidth = 0.72;
        ctx.stroke(road);
      });
      snowLayer(0.65, () => ctx.fillRect(5, 19, 6, 5));
    }
    ctx.restore();
    return true;
  }
}
