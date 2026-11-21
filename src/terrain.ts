import { field, lanes } from "./village-layout";
import { cropRows, cropRowY } from "./core/crops";
import { loadPaintedImage } from "./asset-status";
import { plotPosition } from "./core/local-environment";
import { paintDecayTransition, type DecayTransition } from "./decay-transition";
import { paintedRiverbed } from "./riverbed";
import { drawRiver } from "./water";
import { autumnColour, snowCover } from "./core/seasons";
import type { World } from "./core/types";
/** Continuous material fields: no square tile borders across the painted island. */
export class PaintedTerrain {
  image = new Image();
  materials: HTMLCanvasElement[] = [];
  ready = false;
  private readonly patterns = new WeakMap<
    HTMLCanvasElement,
    Map<number, CanvasPattern>
  >();
  private readonly riverbeds = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
  private plotPaths?: Path2D[];
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
      loadPaintedImage(image, `/assets/terrain-${name}.png`);
    });
  }
  get readyStages() {
    return [0, 1, 2, 3].map((stage) =>
      Boolean(this.stageMaterials[stage]?.length),
    );
  }
  draw(
    ctx: CanvasRenderingContext2D,
    w: World,
    origin: [number, number],
    scale: number,
    water: { level: number; wet: number },
    time: number,
    transition: DecayTransition = { from: 0, to: 0, progress: 0 },
  ) {
    if (!this.ready) return false;
    paintDecayTransition(
      ctx,
      transition,
      [origin[0], origin[1] + 333.5 * scale],
      scale,
      (stage) => this.drawStage(ctx, w, origin, scale, water, time, stage),
    );
    return true;
  }
  private drawStage(
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
      const source = materials[i];
      let bySize = this.patterns.get(source);
      if (!bySize) this.patterns.set(source, (bySize = new Map()));
      let pattern = bySize.get(size);
      if (!pattern) {
        pattern = ctx.createPattern(source, "repeat")!;
        pattern.setTransform(new DOMMatrix().scale(size / 512));
        bySize.set(size, pattern);
      }
      return pattern;
    };
    ctx.fillStyle = material(0);
    ctx.fillRect(0, 0, 29, 29);
    ctx.globalAlpha = Math.max(0, Math.min(1, 1 - w.vegetation / 100));
    ctx.fillStyle = material(1);
    ctx.fillRect(0, 0, 29, 29);
    // Irregular painted patches keep local soil health legible without tile borders.
    if (w.localEnvironment) {
      this.plotPaths ??= Array.from({ length: 36 }, (_, i) => {
        const [x, y] = plotPosition(i);
        const path = new Path2D();
        path.ellipse(x, y, 3.3, 3, Math.sin(i * 2.1) * 0.5, 0, Math.PI * 2);
        return path;
      });
      const soil = material(1, 6);
      w.localEnvironment.plots.forEach((cell, i) => {
        if (cell.health < 100) {
          ctx.globalAlpha = Math.min(0.7, (1 - cell.health / 100) * 0.8);
          ctx.fillStyle = soil;
          ctx.fill(this.plotPaths![i]);
        }
        if (cell.scorch > 1) {
          ctx.globalAlpha = (cell.scorch / 100) * 0.65;
          ctx.fillStyle = "#211c19";
          ctx.fill(this.plotPaths![i]);
        }
      });
    }
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
    let bed = this.riverbeds.get(materials[1]);
    if (!bed) {
      bed = paintedRiverbed(materials[1]);
      this.riverbeds.set(materials[1], bed);
    }
    ctx.drawImage(bed, 0, 0, 9, 29);
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
    for (const [first, ...rest] of lanes) {
      road.moveTo(...first);
      for (const point of rest) road.lineTo(...point);
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#66553a66";
    ctx.lineWidth = 1.1;
    ctx.stroke(road);
    ctx.strokeStyle = material(2, 5);
    ctx.lineWidth = 0.72;
    ctx.stroke(road);
    ctx.fillStyle = material(1, 5);
    ctx.fillRect(field.x, field.y, field.width, field.height);
    for (let row = 0; row < cropRows; row++) {
      ctx.strokeStyle = "#4f3b2799";
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(field.x + 0.2, cropRowY(row));
      ctx.lineTo(field.x + field.width - 0.2, cropRowY(row));
      ctx.stroke();
    }
    if (snow > 0) {
      // Trodden paths stay partly visible; the field disappears under snow.
      snowLayer(0.45, () => {
        ctx.lineWidth = 0.72;
        ctx.stroke(road);
      });
      snowLayer(0.65, () => ctx.fillRect(field.x, field.y, field.width, field.height));
    }
    ctx.restore();
    return true;
  }
}
