/** Large two-pose sheets preserve painted detail when the world is zoomed in. */
export class TurtleDetail {
  images: HTMLImageElement[] = [];
  ready = false;
  private anchors: { top: number; crownX: number; shellWidth: number }[] = [];
  constructor() {
    let loaded = 0;
    for (let pair = 0; pair < 4; pair++) {
      const image = new Image();
      this.images.push(image);
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
        for (let col = 0; col < 2; col++) {
          const left = Math.round((col * image.width) / 2);
          const right = Math.round(((col + 1) * image.width) / 2);
          let top = image.height;
          for (let y = 0; y < image.height && top === image.height; y++) {
            for (let x = left; x < right; x++) {
              if (pixels[(y * image.width + x) * 4 + 3] > 100) {
                top = y;
                break;
              }
            }
          }
          if (top === image.height) return;
          let sum = 0,
            count = 0;
          // Register the unmoving shell crown, never the animated flipper tips.
          for (
            let y = top;
            y < Math.min(image.height, top + (12 * image.width) / 1536);
            y++
          ) {
            for (let x = left; x < right; x++)
              if (pixels[(y * image.width + x) * 4 + 3] > 100) {
                sum += x - left;
                count++;
              }
          }
          let shellLeft = right,
            shellRight = left;
          for (
            let y = top;
            y < Math.min(image.height, top + image.height * 0.2);
            y++
          ) {
            for (let x = left; x < right; x++)
              if (pixels[(y * image.width + x) * 4 + 3] > 100) {
                shellLeft = Math.min(shellLeft, x);
                shellRight = Math.max(shellRight, x);
              }
          }
          this.anchors[pair * 2 + col] = {
            shellWidth: shellRight - shellLeft + 1,
            top,
            crownX: count ? sum / count : (right - left) / 2,
          };
        }
        if (++loaded === 4) this.ready = true;
      };
      image.src = `/assets/turtle-detail-${pair}.png`;
    }
  }
  draw(
    ctx: CanvasRenderingContext2D,
    frame: number,
    x: number,
    y: number,
    height: number,
  ) {
    if (!this.ready) return false;
    const worldScale = height / 1050;
    const fixed = this.anchors[0];
    const fixedScale = (worldScale * 930) / fixed.shellWidth;
    const originX = x - fixed.crownX * fixedScale + 48 * worldScale;
    const originY = y - fixed.top * fixedScale - 71 * worldScale;
    // The load-bearing shell always comes from the same drawing. Only the
    // anatomy below its rim changes pose; registration alone cannot prevent
    // hand-painted shell plates from shifting between authored frames.
    const shell = new Path2D();
    shell.moveTo(-1000, -1000);
    shell.lineTo(2000, -1000);
    shell.lineTo(2000, 460);
    shell.lineTo(690, 460);
    shell.bezierCurveTo(650, 485, 610, 520, 550, 532);
    shell.bezierCurveTo(510, 545, 470, 550, 435, 550);
    shell.bezierCurveTo(380, 548, 350, 532, 320, 525);
    shell.bezierCurveTo(260, 510, 210, 495, 155, 475);
    shell.lineTo(-1000, 475);
    shell.closePath();
    const lower = new Path2D();
    lower.rect(-1000, -1000, 3000, 3000);
    lower.addPath(shell);
    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(fixedScale, fixedScale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    ctx.clip(shell);
    ctx.drawImage(this.images[0], 0, 0, 768, 1024, 0, 0, 768, 1024);
    ctx.restore();
    ctx.clip(lower, "evenodd");
    const image = this.images[Math.floor(frame / 2)];
    const anchor = this.anchors[frame];
    const ratio = fixed.shellWidth / anchor.shellWidth;
    ctx.drawImage(
      image,
      (frame % 2) * 768,
      0,
      768,
      1024,
      fixed.crownX - anchor.crownX * ratio,
      fixed.top - anchor.top * ratio,
      768 * ratio,
      1024 * ratio,
    );
    ctx.restore();
    return true;
  }
}
