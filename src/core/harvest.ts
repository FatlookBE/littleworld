import { hourOf } from "../daylight";
import { field } from "../village-layout";
import { cropRowY } from "./crops";
import { season } from "./seasons";
import type { Villager, World } from "./types";

export const harvestAction = "Récolte les cultures";
const workTicks = 12;
const food = 4;

function availableFarm(w: World) {
  const hour = hourOf(w.tick);
  if (
    hour < 8 ||
    hour >= 19 ||
    season(w.tick) === 3 ||
    w.moisture < 30 ||
    w.food > 100 - food ||
    w.disasters?.some(
      (e) =>
        e.life > 0 &&
        (e.kind === "quake" ||
          e.kind === "blight" ||
          (["fire", "monster", "fight"].includes(e.kind) &&
            e.x >= field.x - 2 &&
            e.x <= field.x + field.width + 2 &&
            e.y >= field.y - 2 &&
            e.y <= field.y + field.height + 2)),
    )
  )
    return;
  return w.buildings.find((b) => b.type === "farm" && b.condition >= 45);
}

const canWork = (v: Villager) =>
  !v.dead && v.age >= 18 && v.health >= 30 && v.morale >= 25 && !v.visit;

// Pathfinding uses tile centres. Alternate columns so two crop rows
// falling in the same tile line still have distinct work positions.
export const harvestStop = (row: number): Villager["target"] => [
  field.x + 2.5 + (row % 2),
  Math.floor(cropRowY(row)) + 0.5,
];

const sameStop = (a: Villager["target"], b: Villager["target"]) =>
  a[0] === b[0] && a[1] === b[1];

export function harvestJob(w: World, v: Villager) {
  const rows = w.cropGrowth;
  if (!rows?.includes(1) || !canWork(v) || !availableFarm(w)) return;
  let best: Villager["target"] | undefined;
  let distance = Infinity;
  for (const [row, growth] of rows.entries()) {
    if (growth < 1) continue;
    const stop = harvestStop(row);
    if (
      w.villagers.some(
        (peer) =>
          peer.id !== v.id &&
          canWork(peer) &&
          peer.action === harvestAction &&
          sameStop(peer.target, stop),
      )
    )
      continue;
    const d = Math.hypot(v.x - stop[0], v.y - stop[1]);
    if (d < distance) {
      best = stop;
      distance = d;
    }
  }
  return best;
}

export function finishHarvest(w: World, v: Villager) {
  const rows = w.cropGrowth;
  if (
    !rows ||
    v.action !== harvestAction ||
    !canWork(v) ||
    v.route.length ||
    v.actionAt === undefined ||
    w.tick - v.actionAt < workTicks ||
    Math.hypot(v.x - v.target[0], v.y - v.target[1]) >= 0.3
  )
    return;
  const farm = availableFarm(w);
  const row = rows.findIndex(
    (growth, i) => growth >= 1 && sameStop(v.target, harvestStop(i)),
  );
  if (!farm || row < 0) return;
  rows[row] = 0;
  w.food += food;
  v.action = "A rempli le garde-manger";
  v.actionAt = w.tick;
  return { farm, row, food };
}
