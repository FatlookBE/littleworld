/** Painted environment assets. Bounds are measured once, never during a frame. */
type Frame = { x: number; y: number; w: number; h: number };
export class EnvironmentAtlas {
  image = new Image();
  frames: Frame[] = [];
  ready = false;
  constructor(
    path = "/assets/environment-atlas.png",
    rows = [0, 1 / 3, 2 / 3, 1],
    columns = [0, 0.25, 0.5, 0.75, 1],
  ) {
    this.image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = this.image.width;
      canvas.height = this.image.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(this.image, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 12; i++) {
        const left = Math.round(columns[i % 4] * canvas.width);
        const right = Math.round(columns[(i % 4) + 1] * canvas.width);
        const top = Math.round(rows[Math.floor(i / 4)] * canvas.height);
        const bottom = Math.round(rows[Math.floor(i / 4) + 1] * canvas.height);
        let x0 = right,
          y0 = bottom,
          x1 = left,
          y1 = top;
        for (let y = top; y < bottom; y++)
          for (let x = left; x < right; x++) {
            if (data[(y * canvas.width + x) * 4 + 3] > 40) {
              x0 = Math.min(x0, x);
              y0 = Math.min(y0, y);
              x1 = Math.max(x1, x);
              y1 = Math.max(y1, y);
            }
          }
        if (x1 < x0 || y1 < y0) return;
        this.frames.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
      }
      this.ready = true;
    };
    this.image.src = path;
  }
  draw(
    ctx: CanvasRenderingContext2D,
    index: number,
    x: number,
    y: number,
    width: number,
    height?: number,
    anchor = 1,
  ) {
    const f = this.frames[index];
    if (!this.ready || !f) return;
    const h = height ?? (width * f.h) / f.w;
    ctx.drawImage(
      this.image,
      f.x,
      f.y,
      f.w,
      f.h,
      x - width / 2,
      y - h * anchor,
      width,
      h,
    );
  }
}

/** Condition thresholds shared by rendering and verification. */
export function buildingDamageStage(condition: number): number {
  return condition > 70 ? 0 : condition > 40 ? 1 : condition > 15 ? 2 : 3;
}
