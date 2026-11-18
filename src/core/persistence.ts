import type { World } from "./types";
import { validateEvent } from "./telemetry";
const KEY = "tokenfall-world-v1";
export function restore(text: string): World {
  const w = JSON.parse(text) as World;
  if (w.version !== 1)
    throw Error("Version de sauvegarde non prise en charge.");
  if (
    !Array.isArray(w.villagers) ||
    w.villagers.length !== 24 ||
    !Array.isArray(w.buildings) ||
    w.buildings.length !== 15 ||
    !Array.isArray(w.usage) ||
    w.usage.length > 20000 ||
    !Array.isArray(w.chronicle) ||
    w.chronicle.length > 160
  )
    throw Error("Sauvegarde incomplète.");
  if (
    !w.settings ||
    !Number.isFinite(w.settings.budget) ||
    w.settings.budget < 1000 ||
    !Number.isFinite(w.tick) ||
    !Number.isFinite(w.seed)
  )
    throw Error("Paramètres invalides.");
  w.usage = w.usage.map(validateEvent);
  const finite = (n: unknown, lo = 0, hi = 100): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;
  const str = (v: unknown) => typeof v === "string" && v.length < 300;
  const point = (p: unknown) =>
    Array.isArray(p) && p.length === 2 && p.every((n) => finite(n, 0, 30));
  const memory = (m: World["chronicle"][number]) =>
    m &&
    Number.isInteger(m.tick) &&
    finite(m.tick, 0, w.tick) &&
    str(m.text) &&
    ["hope", "warning", "ordinary"].includes(m.kind) &&
    (m.person === undefined ||
      (Number.isInteger(m.person) && finite(m.person, 0, 23)));
  const s = w.settings;
  if (
    !Number.isSafeInteger(w.tick) ||
    !finite(w.tick, 0, 1e12) ||
    !finite(w.seed, 0, 4294967295) ||
    !finite(w.savedAt, 0, 9e15) ||
    !str(w.session) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(w.day) ||
    ![
      w.pressure,
      w.relief,
      w.water,
      w.food,
      w.moisture,
      w.fertility,
      w.vegetation,
      w.air,
      w.cooperation,
      w.unrest,
    ].every((v) => finite(v)) ||
    !finite(w.lastUsageTick, 0, w.tick) ||
    !finite(w.replayIndex, 0, 100) ||
    !Number.isInteger(w.replayIndex) ||
    typeof w.replayOn !== "boolean" ||
    !str(w.weather) ||
    !["session", "daily", "persistent"].includes(s.scenario) ||
    !finite(s.budget, 1000, 1e9) ||
    !finite(s.curve, 0.5, 2) ||
    !finite(s.eventFrequency, 0.25, 2) ||
    ![7, 30, 90].includes(s.retentionDays) ||
    ![s.reducedMotion, s.storyCamera, s.includeInput, s.includeOutput].every(
      (b) => typeof b === "boolean",
    ) ||
    !Array.isArray(s.thresholds) ||
    s.thresholds.length !== 5 ||
    !s.thresholds.every(
      (t, i) => finite(t, 1, 99) && (i === 0 || t > s.thresholds[i - 1]),
    ) ||
    !Array.isArray(w.milestones) ||
    w.milestones.length > 6 ||
    !w.milestones.every((m) => Number.isInteger(m) && finite(m, 0, 5)) ||
    !w.chronicle.every(memory) ||
    !Array.isArray(w.snapshots) ||
    w.snapshots.length > 20 ||
    !w.snapshots.every(
      (v) =>
        v &&
        finite(v.tick, 0, 1e12) &&
        finite(v.population, 0, 24) &&
        finite(v.pressure) &&
        str(v.session),
    )
  )
    throw Error("Structure de sauvegarde invalide.");
  const ids = new Set<string>();
  for (const e of w.usage) {
    const id = `${e.origin}\u0000${e.id}`;
    if (ids.has(id)) throw Error("Événements dupliqués dans la sauvegarde.");
    ids.add(id);
  }
  // Version-one saves used departures. Keep their people and last location as remains.
  for (const v of w.villagers) {
    const legacy = v as typeof v & { departed?: boolean; departedAt?: number };
    if (v.dead === undefined && typeof legacy.departed === "boolean") {
      v.dead = legacy.departed;
      if (v.dead) {
        v.diedAt = legacy.departedAt ?? w.tick;
        v.health = 0;
        v.route = [];
        v.target = [v.x, v.y];
        v.action = "Décédé — repose dans le village";
      }
      delete legacy.departed;
      delete legacy.departedAt;
    }
  }
  for (const [i, v] of w.villagers.entries())
    if (
      v.id !== i ||
      !str(v.name) ||
      !str(v.role) ||
      !str(v.action) ||
      !finite(v.age, 0, 120) ||
      !Number.isInteger(v.home) ||
      !finite(v.home, 0, 7) ||
      !finite(v.household, 0, 7) ||
      !point([v.x, v.y]) ||
      !point(v.target) ||
      !Array.isArray(v.route) ||
      v.route.length > 64 ||
      !v.route.every(point) ||
      ![
        v.hunger,
        v.thirst,
        v.energy,
        v.health,
        v.morale,
        v.trust,
        v.resilience,
      ].every((n) => finite(n)) ||
      (v.malnutrition !== undefined && !finite(v.malnutrition)) ||
      typeof v.dead !== "boolean" ||
      (v.hitAt !== undefined &&
        (!Number.isInteger(v.hitAt) || !finite(v.hitAt, 0, w.tick))) ||
      (v.hitSide !== undefined && v.hitSide !== -1 && v.hitSide !== 1) ||
      (v.dead
        ? !Number.isInteger(v.diedAt) ||
          !finite(v.diedAt, 0, w.tick) ||
          v.health !== 0 ||
          v.route.length !== 0
        : v.diedAt !== undefined) ||
      (v.nextDecision !== undefined && !finite(v.nextDecision, 0, 1e12)) ||
      !finite(v.cooldown, 0, 1e12) ||
      !Array.isArray(v.ties) ||
      v.ties.length > 24 ||
      !v.ties.every(
        (t) =>
          t &&
          Number.isInteger(t.id) &&
          finite(t.id, 0, 23) &&
          finite(t.bond) &&
          finite(t.favors, 0, 1e9),
      ) ||
      !Array.isArray(v.memories) ||
      v.memories.length > 24 ||
      !v.memories.every(memory)
    )
      throw Error("Habitants invalides.");
  for (const [i, b] of w.buildings.entries())
    if (
      b.id !== i ||
      !str(b.name) ||
      ![
        "home",
        "well",
        "farm",
        "market",
        "bakery",
        "clinic",
        "workshop",
        "reservoir",
      ].includes(b.type) ||
      !point([b.x, b.y]) ||
      !finite(b.condition) ||
      !Array.isArray(b.events) ||
      b.events.length > 12 ||
      !b.events.every(memory)
    )
      throw Error("Bâtiments invalides.");
  if (w.replay) {
    const r = w.replay;
    if (
      !Array.isArray(r.events) ||
      r.events.length > 20000 ||
      !Number.isInteger(r.cursor) ||
      !finite(r.cursor, 0, r.events.length) ||
      !finite(r.startedTick, 0, w.tick) ||
      !finite(r.firstAt, 0, 9e15)
    )
      throw Error("Replay invalide.");
    r.events = r.events.map(validateEvent);
    if (
      r.events.some(
        (e, i) => i > 0 && Date.parse(e.at) < Date.parse(r.events[i - 1].at),
      )
    )
      throw Error("Replay non ordonné.");
  }
  if (
    w.disasters !== undefined &&
    (!Array.isArray(w.disasters) ||
      w.disasters.length > 12 ||
      !w.disasters.every(
        (e) =>
          e &&
          ["fire", "monster", "fight"].includes(e.kind) &&
          point([e.x, e.y]) &&
          finite(e.life, 0, 2000) &&
          (e.attackAt === undefined ||
            (e.kind === "monster" &&
              Number.isInteger(e.attackAt) &&
              finite(e.attackAt, 0, w.tick) &&
              e.people?.length === 1)) &&
          Array.isArray(e.people) &&
          e.people.length <= 24 &&
          (e.doused === undefined ||
            (e.kind === "fire" && finite(e.doused, 0, 1e6))) &&
          (e.kind !== "fight" ||
            (e.people.length === 2 && e.people[0] !== e.people[1])) &&
          e.people.every((id) => Number.isInteger(id) && finite(id, 0, 23)),
      ))
  )
    throw Error("Catastrophes invalides.");
  return w;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("tokenfall", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("saves");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveWorld(w: World) {
  const copy = JSON.stringify({ ...w, savedAt: Date.now() });
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("saves", "readwrite");
    tx.objectStore("saves").put(copy, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
export async function loadWorld(): Promise<World | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("saves").objectStore("saves").get(KEY);
      req.onsuccess = () => {
        try {
          resolve(req.result ? restore(req.result) : null);
        } catch (e) {
          reject(e);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
