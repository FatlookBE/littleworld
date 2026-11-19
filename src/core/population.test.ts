import { spreadDestination } from "./crowd";
import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import { indoors } from "./shelter";
import { restore } from "./persistence";
import { residentScale, villageCapacity, welcomeChild } from "./population";

function vacancy() {
  const w = createWorld(0);
  const lost = w.villagers[0];
  lost.dead = true;
  lost.health = 0;
  lost.diedAt = 0;
  w.tick = 8 * 288 - 1;
  return { w, lost };
}

it("welcomes a child on a stable day, preserving the deceased and old resident IDs", () => {
  const { w, lost } = vacancy();
  step(w);
  const child = w.villagers[villageCapacity];
  expect(child.age).toBe(0);
  expect(indoors(child, w)).toBe(true);
  expect(w.villagers[0]).toBe(lost);
  expect(child.ties.length).toBeGreaterThan(0);
  expect(w.chronicle.some((m) => m.person === child.id)).toBe(true);
  expect(restore(JSON.stringify(w)).villagers[child.id]).toEqual(child);
});

it("delays new arrivals during scarcity, danger and the interval between births", () => {
  const { w } = vacancy();
  w.tick++;
  w.food = 30;
  expect(welcomeChild(w)).toBeUndefined();
  w.food = 90;
  w.disasters = [
    { kind: "monster", species: "wolf", x: 24, y: 24, life: 30, people: [] },
  ];
  expect(welcomeChild(w)).toBeUndefined();
  w.disasters = [];
  expect(welcomeChild(w)).toBeDefined();
  w.villagers[2].dead = true;
  w.tick += 288;
  expect(welcomeChild(w)).toBeUndefined();
});

it("grows from home care to outdoor play, then takes up a trade, once across reloads", () => {
  const { w } = vacancy();
  step(w);
  const loaded = restore(JSON.stringify(w));
  const child = loaded.villagers[villageCapacity];
  const infantSize = residentScale(child);
  loaded.tick = child.bornAt! + 9 * 288 - 1;
  step(loaded);
  expect(child.age).toBe(3);
  expect(indoors(child, loaded)).toBe(false);
  expect(residentScale(child)).toBeGreaterThan(infantSize);
  loaded.tick = child.bornAt! + 54 * 288 - 1;
  step(loaded);
  expect(child.age).toBe(18);
  expect(child.role).not.toBe("Enfant du village");
  expect(residentScale(child)).toBe(1);
  step(loaded);
  expect(
    loaded.chronicle.filter(
      (m) => m.person === child.id && m.text.includes("atteint l’âge"),
    ),
  ).toHaveLength(1);
});

it("moves a newborn out of a threatened home and ignores sheltered newborns in crowd routing", () => {
  const { w } = vacancy();
  step(w);
  const child = w.villagers[villageCapacity];
  const home = w.buildings[child.home];
  const walker = w.villagers[4];
  const targetBefore = spreadDestination(w, walker, [child.x, child.y]);
  child.dead = true;
  expect(spreadDestination(w, walker, [child.x, child.y])).toEqual(
    targetBefore,
  );
  child.dead = false;
  w.disasters = [{ kind: "fire", x: home.x, y: home.y, life: 200, people: [] }];
  step(w);
  expect(child.home).not.toBe(home.id);
  expect(indoors(child, w)).toBe(true);
  expect(
    w.chronicle.some(
      (event) =>
        event.person === child.id && event.text.includes("mis à l’abri"),
    ),
  ).toBe(true);
});
