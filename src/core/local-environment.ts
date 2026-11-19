import type { World } from "./types";
import { riverCenter } from "./navigation";
const clamp = (v: number) => Math.max(0, Math.min(100, v));
const noise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
export const treePosition = (i: number): [number, number] => [
  1 + noise(i, 1) * 27,
  1 + noise(i, 2) * 27,
];
export const plotPosition = (i: number): [number, number] => [
  (((i % 6) + 0.5) * 29) / 6,
  ((Math.floor(i / 6) + 0.5) * 29) / 6,
];
export interface LocalEnvironment {
  trees: { health: number; scorch: number }[];
  plots: { health: number; scorch: number }[];
}
export function ensureLocalEnvironment(w: World) {
  return (w.localEnvironment ??= {
    trees: Array.from({ length: 135 }, () => ({
      health: w.vegetation,
      scorch: 0,
    })),
    plots: Array.from({ length: 36 }, () => ({
      health: (w.vegetation + w.fertility) / 2,
      scorch: 0,
    })),
  });
}
export function localHealth(w: World, x: number, y: number) {
  const col = Math.max(0, Math.min(5, Math.floor((x * 6) / 29)));
  const row = Math.max(0, Math.min(5, Math.floor((y * 6) / 29)));
  return w.localEnvironment?.plots[row * 6 + col]?.health ?? w.vegetation;
}
export function updateLocalEnvironment(w: World) {
  const local = ensureLocalEnvironment(w);
  const update = (
    cell: { health: number; scorch: number },
    [x, y]: [number, number],
    tree: boolean,
  ) => {
    const bank = Math.max(0, 1 - Math.abs(x - riverCenter(y)) / 7);
    const shelter = noise(x, y);
    // Rain-fed soils can recover away from the river after reserves return.
    const replenished = w.pressure < 20 && w.water > 60 && w.moisture > 55;
    const irrigation = replenished
      ? bank + (1 - bank) * Math.min(0.6, (w.moisture - 55) / 50)
      : bank;
    const wet = w.moisture * 0.65 + w.water * irrigation * 0.35;
    const target = clamp(
      wet + shelter * 12 - w.pressure * (0.2 + (1 - shelter) * 0.2),
    );
    const burning = w.disasters?.some(
      (e) =>
        e.kind === "fire" && Math.hypot(x - e.x, y - e.y) < (tree ? 2.2 : 3.5),
    );
    const blighted = w.disasters?.some(
      (e) => e.kind === "blight" && Math.hypot(x - e.x, y - e.y) < 5,
    );
    if (burning) {
      cell.scorch = clamp(cell.scorch + 0.6);
      cell.health = clamp(cell.health - 0.45);
    } else {
      cell.scorch = clamp(cell.scorch - (wet > 55 ? 0.015 : 0.002));
      const goal = Math.min(target, 100 - cell.scorch);
      cell.health = clamp(
        cell.health +
          (goal - cell.health) * (goal > cell.health ? 0.001 : 0.004),
      );
    }
    if (blighted) cell.health = clamp(cell.health - 0.12);
  };
  local.trees.forEach((cell, i) => update(cell, treePosition(i), true));
  local.plots.forEach((cell, i) => update(cell, plotPosition(i), false));
}
/** Local upkeep and exposure supplement existing fire damage and repair actions. */
export function buildingWear(w: World, b: World["buildings"][number]) {
  const residents = w.villagers.filter((v) => !v.dead && v.home === b.id);
  const upkeep = residents.length
    ? residents.reduce((s, v) => s + v.health / 100, 0) / residents.length
    : 0;
  const exposure = 0.7 + noise(b.x, b.y) * 0.6;
  const dry = 1 - localHealth(w, b.x, b.y) / 100;
  return {
    exposure: exposure * (1 + dry * 0.45),
    repair: w.pressure < 20 ? 0.003 + 0.005 * upkeep : 0,
  };
}
