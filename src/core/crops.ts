import { localHealth } from "./local-environment";
import { season } from "./seasons";
import type { World } from "./types";

export const cropRows = 6;
export const cropRowY = (row: number) => 19.45 + row * 0.8;
export const initialGrowth = (row: number) =>
  [0.1, 0.28, 0.04, 0.19, 0.08, 0.32][row];

export function growCrops(w: World) {
  const rows = (w.cropGrowth ??= Array.from({ length: cropRows }, (_, i) =>
    initialGrowth(i),
  ));
  const winter = season(w.tick) === 3;
  for (let row = 0; row < rows.length; row++) {
    const soil = localHealth(w, 8, cropRowY(row));
    const conditions = Math.min(w.moisture, soil, w.fertility) / 100;
    const rate = (conditions - 0.18) * (winter && conditions > 0.18 ? 0.2 : 1);
    rows[row] = Math.max(
      0,
      Math.min(1, rows[row] + rate / (540 + (row % 3) * 90)),
    );
  }
}
