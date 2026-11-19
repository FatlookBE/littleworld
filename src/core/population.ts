import { homeIsUnsafe } from "./shelter";
import type { Villager, World } from "./types";
import { doorStep } from "./home-visits";

export const villageCapacity = 24;
export const residentRecordLimit = 512;
const villageDay = 288;
const birthInterval = 8 * villageDay;
const childhoodYear = 3 * villageDay;
const names = [
  "Lison",
  "Noé",
  "Ninon",
  "Robin",
  "Iris",
  "Rémi",
  "Alma",
  "Maël",
];
const trades = [
  "Cultivateur",
  "Boulanger",
  "Porteur d’eau",
  "Charpentier",
  "Soigneur",
  "Artisan",
  "Jardinier",
  "Marchand",
];

export function growResident(w: World, v: Villager) {
  if (v.dead || v.bornAt === undefined || v.age >= 18) return false;
  v.age = Math.min(18, Math.floor((w.tick - v.bornAt) / childhoodYear));
  if (v.age !== 18) return false;
  v.role = trades[v.id % trades.length];
  v.nextDecision = w.tick;
  return true;
}

export function residentScale(v: Villager) {
  return v.age >= 18 ? 1 : 0.48 + (v.age / 18) * 0.52;
}

export function welcomeChild(w: World): Villager | undefined {
  if (
    w.tick % villageDay ||
    w.tick - (w.lastBirthAt ?? 0) < birthInterval ||
    w.villagers.length >= residentRecordLimit ||
    w.pressure >= 25 ||
    w.food < 55 ||
    w.water < 55 ||
    w.disasters?.some(
      (event) =>
        event.life > 0 &&
        ["fire", "monster", "plague", "quake"].includes(event.kind),
    )
  )
    return;
  const alive = w.villagers.filter((v) => !v.dead);
  if (alive.length >= villageCapacity) return;
  const home = w.buildings
    .filter((b) => b.type === "home" && b.condition > 55)
    .map((b) => ({ b, people: alive.filter((v) => v.home === b.id) }))
    .filter(
      ({ people }) =>
        people.length < 3 && people.some((v) => v.age >= 18 && v.health >= 65),
    )
    .sort(
      (a, b) =>
        a.people.length - b.people.length || b.b.condition - a.b.condition,
    )[0];
  if (!home) return;
  const [x, y] = doorStep(home.b);
  const id = w.villagers.length;
  const child: Villager = {
    id,
    name: names[(id - villageCapacity) % names.length],
    age: 0,
    bornAt: w.tick,
    role: "Enfant du village",
    home: home.b.id,
    household: home.b.id,
    x,
    y,
    target: [x, y],
    route: [],
    action: "Grandit au foyer",
    hunger: 10,
    thirst: 10,
    energy: 95,
    health: 100,
    morale: 90,
    trust: 70,
    resilience: 65,
    dead: false,
    ties: home.people.map((v) => ({ id: v.id, bond: 80, favors: 0 })),
    memories: [],
    cooldown: w.tick + 20,
  };
  w.villagers.push(child);
  for (const person of home.people) {
    person.ties.unshift({ id, bond: 80, favors: 0 });
    person.ties.length = Math.min(person.ties.length, 24);
  }
  w.lastBirthAt = w.tick;
  return child;
}

/** A household moves its youngest out of a burning or collapsed home. */
export function relocateInfant(w: World, infant: Villager) {
  const home = w.buildings[infant.home];
  if (!homeIsUnsafe(w, home)) return;
  const shelter = w.buildings
    .filter((b) => b.type === "home" && !homeIsUnsafe(w, b))
    .sort(
      (a, b) =>
        Math.hypot(a.x - home.x, a.y - home.y) -
        Math.hypot(b.x - home.x, b.y - home.y),
    )
    .find((b) =>
      w.villagers.some(
        (v) => !v.dead && v.age >= 18 && v.health > 30 && v.home === b.id,
      ),
    );
  if (!shelter) {
    infant.action = "Attend des secours à l’extérieur";
    return;
  }
  infant.home = infant.household = shelter.id;
  [infant.x, infant.y] = doorStep(shelter);
  infant.target = [infant.x, infant.y];
  infant.route = [];
  infant.action = "Grandit au foyer";
  return shelter;
}
