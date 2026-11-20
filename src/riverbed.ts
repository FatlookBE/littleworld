import { riverCenter } from "./core/navigation";

// Rasterize once in map coordinates so the painted banks stay fixed under the current.
const density = 64;
const width = 9;
const length = 29;
const hash = (n: number) => {
  const value = Math.sin(n * 127.1 + 19.3) * 43758.5453;
  return value - Math.floor(value);
};
function noise(y: number, seed: number) {
  const n = Math.floor(y),
    t = y - n;
  return (
    hash(n + seed) + (hash(n + seed + 1) - hash(n + seed)) * t * t * (3 - 2 * t)
  );
}
const margin = (y: number, side: number) =>
  1.62 + noise(y * 0.68, side * 93) * 0.52 + noise(y * 4.2, side * 73) * 0.16;

export function paintedRiverbed(soil: HTMLCanvasElement) {
  const bed = document.createElement("canvas");
  bed.width = width * density;
  bed.height = length * density;
  const ctx = bed.getContext("2d")!;
  const tile = 4 * density;
  for (let y = 0; y < bed.height; y += tile)
    for (let x = 0; x < bed.width; x += tile)
      ctx.drawImage(soil, x, y, tile, tile);

  const pixels = ctx.getImageData(0, 0, bed.width, bed.height);
  for (let row = 0; row < bed.height; row++) {
    const y = row / density,
      center = riverCenter(y);
    const left = margin(y, -1),
      right = margin(y, 1);
    for (let col = 0; col < bed.width; col++) {
      const dx = col / density - center;
      const inset = (dx < 0 ? left : right) - Math.abs(dx);
      const i = (row * bed.width + col) * 4;
      const blend = Math.min(1, Math.max(0, inset / 0.38));
      pixels.data[i + 3] = 255 * blend * blend * (3 - 2 * blend);
      const shade = 1 - 0.24 * Math.min(1, Math.max(0, inset));
      for (let k = 0; k < 3; k++) pixels.data[i + k] *= shade;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  ctx.scale(density, density);
  // Small gravel bars collect on alternating banks, with light on the upstream face.
  for (let cluster = 0; cluster < 31; cluster++) {
    const y = hash(cluster + 23) * length,
      side = cluster % 2 ? -1 : 1;
    for (let j = 0; j < 9; j++) {
      const seed = cluster * 19 + j;
      const py = y + (hash(seed + 50) - 0.5) * 1.12;
      const px =
        riverCenter(py) +
        side * (margin(py, side) - 0.22 - hash(seed + 17) * 0.65);
      const r = 0.035 + hash(seed + 95) * 0.095;
      ctx.fillStyle = "#443d32aa";
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.64, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b0a384ac";
      ctx.beginPath();
      ctx.ellipse(
        px - r * 0.19,
        py - r * 0.17,
        r * 0.69,
        r * 0.37,
        -0.45,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  return bed;
}
