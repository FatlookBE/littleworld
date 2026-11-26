import { loadPaintedImage } from "./asset-status";

const CELL = 96;
const COLUMNS = 4;
const tiles = {
  sawhorse: 0,
  bucket: 1,
  starter: 2,
  loaves: 3,
  seedBasket: 4,
  seedSack: 5,
  lantern: 6,
  cistern: 7,
} as const;

let sheet: HTMLImageElement | undefined;

/** Return false while the atlas is unavailable, so clues can still be drawn. */
export function drawPaintedProp(
  c: CanvasRenderingContext2D,
  prop: keyof typeof tiles,
  x: number,
  ground: number,
  size: number,
): boolean {
  if (!sheet && typeof Image !== "undefined") {
    sheet = new Image();
    loadPaintedImage(sheet, "/assets/painted-props.webp");
  }
  if (!sheet?.complete || sheet.naturalWidth !== COLUMNS * CELL || sheet.naturalHeight !== 2 * CELL) return false;
  const index = tiles[prop];
  c.drawImage(
    sheet,
    (index % COLUMNS) * CELL, Math.floor(index / COLUMNS) * CELL, CELL, CELL,
    x - size / 2, ground - size, size, size,
  );
  return true;
}
