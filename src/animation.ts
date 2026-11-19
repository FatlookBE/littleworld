/** Playback helpers and fixed-size cells keep animation from resizing between poses. */
export function loopFrame(
  time: number,
  count: number,
  fps: number,
  offset = 0,
  reduced = false,
) {
  return reduced
    ? 0
    : ((Math.floor(time * fps + offset) % count) + count) % count;
}
export class AnimationAtlas {
  image = new Image();
  ready = false;
  readonly columns: number;
  readonly rows: number;
  baselines: number[] = [];
  anchors: number[] = [];
  columnOffset: number;
  heights: number[] = [];
  private rowCuts?: readonly number[];
  constructor(
    path: string,
    columns: number,
    rows: number,
    columnOffset = 0,
    anchorBase = false,
    sameScale = false,
    rowCuts?: readonly number[],
  ) {
    this.rowCuts = rowCuts;
    this.columnOffset = columnOffset;
    this.columns = columns;
    this.rows = rows;
    this.image.onload = () => {
      const c = document.createElement("canvas");
      c.width = this.image.width;
      c.height = this.image.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(this.image, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let row = 0; row < rows; row++) {
        let tallest = 0;
        for (let col = 0; col < columns; col++) {
          const x0 = this.columnEdge(col),
            x1 = this.columnEdge(col + 1);
          const y0 = this.rowEdge(row),
            y1 = this.rowEdge(row + 1);
          let top = y1,
            bottom = y0 - 1;
          for (let y = y0; y < y1; y++)
            for (let x = x0; x < x1; x++) {
              if (data[(y * c.width + x) * 4 + 3] > 40) {
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
              }
            }
          if (bottom < top) return;
          this.baselines.push(bottom - y0 + 1);
          let anchor = ((col + 0.5) * c.width) / columns + columnOffset;
          if (anchorBase) {
            let sum = 0,
              count = 0;
            for (let y = Math.max(top, bottom - 6); y <= bottom; y++)
              for (let x = x0; x < x1; x++) {
                if (data[(y * c.width + x) * 4 + 3] > 100) {
                  sum += x;
                  count++;
                }
              }
            if (count) anchor = sum / count;
          }
          this.anchors.push(anchor - x0);
          tallest = Math.max(tallest, bottom - top + 1);
        }
        this.heights.push(tallest);
      }
      if (anchorBase || sameScale) this.heights.fill(Math.max(...this.heights));
      this.ready = true;
    };
    this.image.src = path;
  }
  rowEdge(row: number) {
    return (
      this.rowCuts?.[row] ?? Math.round((row * this.image.height) / this.rows)
    );
  }
  columnEdge(col: number) {
    if (col === 0) return 0;
    // The fourth/fifth poses are closer in this authored walking sheet.
    if (this.columnOffset === 24 && col === 4) return 772;
    return Math.min(
      this.image.width,
      Math.round((col * this.image.width) / this.columns + this.columnOffset),
    );
  }
  draw(
    ctx: CanvasRenderingContext2D,
    index: number,
    x: number,
    y: number,
    height: number,
    mirror = false,
    fixedAnchor?: number,
  ) {
    if (!this.ready) return false;
    const row = Math.floor(index / this.columns),
      col = index % this.columns;
    const x0 = this.columnEdge(col),
      x1 = this.columnEdge(col + 1);
    const y0 = this.rowEdge(row),
      y1 = this.rowEdge(row + 1);
    const k = height / this.heights[row];
    ctx.save();
    ctx.translate(x, y);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(
      this.image,
      x0,
      y0,
      x1 - x0,
      y1 - y0,
      -this.anchors[index] * k,
      -(fixedAnchor === undefined
        ? this.baselines[index]
        : fixedAnchor * (y1 - y0)) * k,
      (x1 - x0) * k,
      (y1 - y0) * k,
    );
    ctx.restore();
    return true;
  }
}
