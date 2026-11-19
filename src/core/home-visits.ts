import type { Building, Villager, World } from "./types";
import { findRoute } from "./navigation";
import { moveResident } from "./crowd";
export interface HomeVisit {
  building: number;
  phase: "approaching" | "entering" | "inside" | "exiting";
  since: number;
  until: number;
}
export const doorStep = (b: Building): [number, number] => [
  b.x + 0.5,
  b.y + 2.5,
];
export const indoors = (v: Villager) => !v.dead && v.visit?.phase === "inside";
const dangerous = (w: World, b: Building) =>
  b.condition <= 15 ||
  w.disasters?.some(
    (e) =>
      e.kind === "fire" && e.life > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 3,
  );
export function doorBusy(w: World, b: number, except: number) {
  return w.villagers.some(
    (v) =>
      !v.dead &&
      v.id !== except &&
      v.visit?.building === b &&
      v.visit.phase !== "inside",
  );
}
export function cancelVisit(w: World, v: Villager) {
  const b = w.buildings.find((b) => b.id === v.visit?.building);
  if (b && v.visit?.phase !== "approaching") [v.x, v.y] = doorStep(b);
  delete v.visit;
  v.route = [];
  v.target = [v.x, v.y];
  v.visitAfter = w.tick + 160 + v.id * 3;
  v.nextDecision = w.tick + 2;
}
export function tryHomeVisit(w: World, v: Villager) {
  if (
    v.dead ||
    v.visit ||
    w.tick < (v.visitAfter ?? 0) ||
    !v.action.includes("maison") ||
    w.disasters?.some((e) => e.kind === "fight" && e.people.includes(v.id)) ||
    v.route.length
  )
    return false;
  const b = w.buildings.find((b) => b.id === v.home && b.type === "home");
  if (
    !b ||
    dangerous(w, b) ||
    doorBusy(w, b.id, v.id) ||
    Math.hypot(v.x - b.x, v.y - b.y) > 5
  )
    return false;
  v.visit = {
    building: b.id,
    phase: "approaching",
    since: w.tick,
    until: w.tick + 120,
  };
  v.route = findRoute(w, [v.x, v.y], doorStep(b));
  v.target = v.route.at(-1) ?? [v.x, v.y];
  v.action = "Rejoint la porte de sa maison";
  return true;
}
/** Visits share one door transition, while several residents may rest inside. */
export function updateHomeVisit(w: World, v: Villager) {
  const visit = v.visit;
  if (!visit) return false;
  const b = w.buildings.find(
    (b) => b.id === visit.building && b.type === "home",
  );
  if (!b || v.dead) {
    cancelVisit(w, v);
    return false;
  }
  const threat = dangerous(w, b);
  if (visit.phase === "approaching") {
    if (
      threat ||
      v.thirst > 75 ||
      v.hunger > 80 ||
      w.tick > visit.until ||
      (v.hitAt !== undefined && w.tick - v.hitAt >= 0 && w.tick - v.hitAt < 4)
    ) {
      cancelVisit(w, v);
      return false;
    }
    moveResident(w, v, 0.11 * (0.6 + v.energy / 250));
    const [x, y] = doorStep(b);
    if (!v.route.length && Math.hypot(v.x - x, v.y - y) < 0.35) {
      visit.phase = "entering";
      visit.since = w.tick;
      visit.until = w.tick + 9;
      v.action = "Ouvre la porte et rentre chez soi";
      v.actionAt = w.tick;
    } else if (!v.route.length) {
      cancelVisit(w, v);
      return false;
    }
    return true;
  }
  if (visit.phase === "entering") {
    if (threat) {
      cancelVisit(w, v);
      return false;
    }
    if (w.tick - visit.since >= 9) {
      visit.phase = "inside";
      visit.since = w.tick;
      visit.until = w.tick + 60 + (v.id % 40);
      v.action = "Se repose à l’intérieur de sa maison";
      v.route = [];
      v.target = [v.x, v.y];
    }
  } else if (visit.phase === "inside") {
    if (threat || v.thirst > 60 || v.hunger > 65 || w.tick >= visit.until) {
      if (!doorBusy(w, b.id, v.id)) {
        visit.phase = "exiting";
        visit.since = w.tick;
        visit.until = w.tick + 9;
        v.action = threat
          ? "Quitte sa maison menacée"
          : "Ouvre la porte et sort de sa maison";
        v.actionAt = w.tick;
      }
    }
  } else if (w.tick - visit.since >= 9) {
    cancelVisit(w, v);
    v.action = "Referme la porte derrière soi";
    v.actionAt = w.tick;
  }
  return true;
}
export function doorOpening(age: number) {
  return Math.max(0, Math.min(1, age / 3, (9 - age) / 3));
}
