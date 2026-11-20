import { expect, it } from "vitest";
import { createWorld } from "./core/engine";
import { extraResidentPose } from "./extra-residents";
import { residentSkin } from "./sprites";

it("distributes both new looks across households and later generations", () => {
  const w = createWorld(0);
  for (const skin of [4, 5]) {
    const people = w.villagers.filter(
      (person) => residentSkin(person.id) === skin,
    );
    expect(new Set(people.map((person) => person.home)).size).toBe(3);
    expect(
      people.every((person) => residentSkin(person.id + 24) === skin),
    ).toBe(true);
  }
});

it.each([
  ["Cueille des plantes", 16],
  ["Répare son logement", 20],
  ["Boit au point d’eau", 24],
  ["Prend un repas", 28],
  ["Pétrit le pain", 32],
  ["Soigne ses voisins", 36],
  ["Porte de l’eau", 40],
])("runs the four illustrated poses of %s", (action, start) => {
  const w = createWorld(0);
  const person = w.villagers[1];
  person.action = action;
  person.actionAt = 0;
  person.target = [person.x, person.y];
  if (start === 40) person.route = [[person.x + 1, person.y]];
  const frameInterval = start === 40 ? 1 / 8 : 1 / 5;
  const frames = [0, 1, 2, 3].map(
    (index) =>
      extraResidentPose(person, w, frameInterval * (index + 0.1)).frame,
  );
  expect(frames).toEqual([start, start + 1, start + 2, start + 3]);
  w.settings.reducedMotion = true;
  expect(extraResidentPose(person, w, 40).frame).toBe(start);
  person.malnutrition = 80;
  expect(extraResidentPose(person, w, 40).frame).toBe(start + 48);
});

it("keeps the seven walk poses and prioritizes hit, combat and rest in famine", () => {
  const w = createWorld(0);
  const person = w.villagers[5];
  person.malnutrition = 80;
  person.route = [[person.x - 1, person.y]];
  const walk = Array.from({ length: 7 }, (_, i) =>
    extraResidentPose(person, w, (i + 0.1) / 7),
  );
  expect(new Set(walk.map((pose) => pose.frame)).size).toBe(7);
  expect(
    walk.every(({ frame, mirror }) => frame > 48 && frame < 56 && mirror),
  ).toBe(true);
  w.disasters = [
    { kind: "fight", x: person.x, y: person.y, life: 90, people: [person.id] },
  ];
  expect(extraResidentPose(person, w, 0).frame).toBe(58);
  person.hitAt = w.tick;
  person.hitSide = 1;
  expect(extraResidentPose(person, w, w.tick * 0.2)).toEqual({
    frame: 60,
    mirror: true,
  });
  person.hitAt = undefined;
  w.disasters = [];
  person.route = [];
  person.action = "Se repose";
  expect(extraResidentPose(person, w, 0).frame).toBe(62);
  person.health = 5;
  expect(extraResidentPose(person, w, 0).frame).toBe(63);
});
