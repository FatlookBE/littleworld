import { it, expect } from "vitest";
import { createWorld, step } from "./engine";
import { apocalypse } from "./apocalypse";
import { restore } from "./persistence";
it("bounds simultaneous disasters and preserves their save", () => {
  const w = createWorld(0);
  w.tick = 60;
  w.pressure = 95;
  w.moisture = 0;
  w.food = 0;
  w.disasters = Array.from({ length: 11 }, () => ({
    kind: "monster" as const,
    x: 25,
    y: 25,
    life: 500,
    people: [],
  }));
  apocalypse(
    w,
    () => 0,
    () => {},
  );
  expect(w.disasters.length).toBeLessThanOrEqual(12);
  expect(restore(JSON.stringify(w)).disasters).toEqual(w.disasters);
});
it("fire damages buildings, fights hold participants and name bystander behavior accurately", () => {
  const w = createWorld(0);
  const [a, b, c] = w.villagers;
  a.x = b.x = c.x = 13.5;
  a.y = b.y = c.y = 15.5;
  w.disasters = [
    { kind: "fire", x: 8, y: 9, life: 100, people: [] },
    { kind: "fight", x: 13.5, y: 15.5, life: 90, people: [0, 1] },
  ];
  step(w);
  expect(w.buildings[0].condition).toBeLessThan(100);
  expect(a.action).toContain("Se bat");
  expect(a.route).toEqual([]);
  expect(c.action).toContain("bagarre");
  expect(c.action).not.toContain("créature");
});
it("healthy world has no disasters", () => {
  const w = createWorld(0);
  for (let i = 0; i < 1000; i++) step(w);
  expect(w.disasters).toEqual([]);
});
it("rejects fights without two distinct participants", () => {
  for (const people of [[], [0], [0, 0]]) {
    const w = createWorld(0);
    w.disasters = [{ kind: "fight", x: 13, y: 15, life: 80, people }];
    expect(() => restore(JSON.stringify(w))).toThrow();
    expect(() => step(w)).not.toThrow();
  }
});

it("monsters wind up before a single in-range impact and retain combat state across saves", () => {
  const w = createWorld(0);
  w.villagers.forEach((v) => {
    v.x = 25;
    v.y = 25;
  });
  const victim = w.villagers[0];
  victim.x = 13;
  victim.y = 15;
  w.disasters = [{ kind: "monster", x: 12, y: 15, life: 200, people: [] }];
  w.tick = 1;
  apocalypse(
    w,
    () => 1,
    () => {},
  );
  expect(w.disasters[0].attackAt).toBe(1);
  const initial = victim.health;
  for (w.tick = 2; w.tick < 5; w.tick++)
    apocalypse(
      w,
      () => 1,
      () => {},
    );
  expect(victim.health).toBe(initial);
  apocalypse(
    w,
    () => 1,
    () => {},
  );
  expect(victim.health).toBe(initial - 3);
  expect(victim.hitAt).toBe(5);
  w.tick = 6;
  apocalypse(
    w,
    () => 1,
    () => {},
  );
  expect(victim.health).toBe(initial - 3);
  const restored = restore(JSON.stringify(w));
  expect(restored.villagers[0].hitAt).toBe(5);
  expect(restored.disasters?.[0].attackAt).toBe(1);
});
it("a victim outside attack reach evades the impact; invalid reaction timestamps are rejected", () => {
  const w = createWorld(0);
  w.villagers.forEach((v) => {
    v.x = 25;
    v.y = 25;
  });
  const v = w.villagers[0];
  v.x = 13;
  v.y = 15;
  w.disasters = [{ kind: "monster", x: 12, y: 15, life: 200, people: [] }];
  w.tick = 1;
  apocalypse(
    w,
    () => 1,
    () => {},
  );
  v.x = 20;
  const health = v.health;
  w.tick = 5;
  apocalypse(
    w,
    () => 1,
    () => {},
  );
  expect(v.health).toBe(health);
  expect(v.hitAt).toBeUndefined();
  v.hitAt = 6;
  expect(() => restore(JSON.stringify(w))).toThrow();
  delete v.hitAt;
  w.disasters[0].attackAt = 6;
  expect(() => restore(JSON.stringify(w))).toThrow();
});

it("neighbours form a bucket line that puts out a fire using the reserve", () => {
  const w = createWorld(0);
  w.water = 80;
  w.disasters = [{ kind: "fire", x: 8, y: 9, life: 400, people: [] }];
  for (const v of w.villagers.slice(0, 4)) {
    v.x = 10.5;
    v.y = 12.5;
  }
  let ticks = 0;
  let lowest = w.water;
  while (w.disasters.length && ticks < 400) {
    step(w);
    lowest = Math.min(lowest, w.water);
    ticks++;
  }
  expect(ticks).toBeLessThan(250);
  expect(w.chronicle.some((e) => e.text.includes("chaîne de seaux"))).toBe(
    true,
  );
  const out = w.chronicle.find((e) => e.text.includes("est éteint"));
  expect(out?.kind).toBe("hope");
  expect(restore(JSON.stringify(w)).tick).toBe(w.tick);
});

it("a village without water can only watch the fire burn", () => {
  const w = createWorld(0);
  w.disasters = [{ kind: "fire", x: 8, y: 9, life: 120, people: [] }];
  for (const v of w.villagers.slice(0, 4)) {
    v.x = 10.5;
    v.y = 12.5;
  }
  let ticks = 0;
  while (w.disasters.length && ticks < 400) {
    w.water = 0;
    step(w);
    ticks++;
  }
  expect(ticks).toBeGreaterThanOrEqual(119);
  expect(w.chronicle.some((e) => e.text.includes("est éteint"))).toBe(false);
});

it("restores a fire's bucket-line progress and rejects it elsewhere", () => {
  const w = createWorld(0);
  w.disasters = [
    { kind: "fire", x: 8, y: 9, life: 100, people: [1, 2], doused: 12 },
  ];
  expect(restore(JSON.stringify(w)).disasters).toEqual(w.disasters);
  w.disasters = [
    { kind: "monster", x: 8, y: 9, life: 100, people: [], doused: 3 },
  ];
  expect(() => restore(JSON.stringify(w))).toThrow();
});

it("an unattended fire spreads to a nearby roof in dry weather, never in the rain", () => {
  const dry = createWorld(0);
  dry.tick = 288 * 4 + 17; // summer, one tick before a multiple of 30
  dry.moisture = 5;
  dry.water = 0;
  dry.villagers.forEach((v) => (v.dead = true));
  dry.disasters = [{ kind: "fire", x: 8, y: 9, life: 300, people: [] }];
  for (let i = 0; i < 6; i++) {
    dry.tick++;
    dry.weather = "Chaleur sèche";
    apocalypse(
      dry,
      () => 0,
      () => {},
    );
    dry.tick += 29;
  }
  expect(dry.disasters.filter((e) => e.kind === "fire").length).toBeGreaterThan(
    1,
  );

  const wet = createWorld(0);
  wet.tick = 29;
  wet.moisture = 5;
  wet.weather = "Pluie légère";
  wet.disasters = [{ kind: "fire", x: 8, y: 9, life: 300, people: [] }];
  wet.tick++;
  apocalypse(
    wet,
    () => 0,
    () => {},
  );
  expect(wet.disasters.filter((e) => e.kind === "fire")).toHaveLength(1);
});

it("burning stores take food with them", () => {
  const w = createWorld(0);
  w.food = 50;
  w.villagers.forEach((v) => (v.dead = true));
  w.disasters = [{ kind: "fire", x: 16, y: 13, life: 100, people: [] }];
  apocalypse(
    w,
    () => 0.99,
    () => {},
  );
  expect(w.food).toBeLessThan(50);
});

it("new disasters strike, spread and end, and survive a save", () => {
  const w = createWorld(0);
  const damp = () => {};
  w.disasters = [
    { kind: "quake", x: 14, y: 14, life: 5, people: [] },
    { kind: "blight", x: 14, y: 14, life: 5, people: [] },
    { kind: "plague", x: 14, y: 14, life: 5, people: [0] },
  ];
  const cond = w.buildings[0].condition,
    food = w.food,
    hp = w.villagers[0].health;
  w.tick = 1;
  apocalypse(w, () => 0.99, damp);
  expect(w.buildings[0].condition).toBeLessThan(cond);
  expect(w.food).toBeLessThan(food);
  expect(w.villagers[0].health).toBeLessThan(hp);
  expect(restore(JSON.stringify(w)).disasters).toEqual(w.disasters);
  for (let i = 0; i < 6; i++) apocalypse(w, () => 0.99, damp);
  expect(w.disasters).toEqual([]);
});

it("wolves are fast and bite lightly; wraiths sap morale and fade at dawn", () => {
  const w = createWorld(0);
  const [v] = w.villagers;
  v.x = 12;
  v.y = 15;
  w.disasters = [
    { kind: "monster", species: "wolf", x: 12, y: 18, life: 500, people: [] },
  ];
  const d0 = Math.hypot(v.x - 12, v.y - 18);
  w.tick = 100;
  apocalypse(
    w,
    () => 0.99,
    () => {},
  );
  expect(
    Math.hypot(v.x - w.disasters[0].x, v.y - w.disasters[0].y),
  ).toBeLessThan(d0 - 0.05);
  const m = v.morale;
  w.tick = 200; // late evening
  w.disasters = [
    {
      kind: "monster",
      species: "wraith",
      x: 12,
      y: 15.5,
      life: 400,
      people: [],
    },
  ];
  apocalypse(
    w,
    () => 0.99,
    () => {},
  );
  expect(v.morale).toBeLessThan(m);
  w.tick = 288 * 2 + 60; // morning
  apocalypse(
    w,
    () => 0.99,
    () => {},
  );
  expect(w.disasters).toEqual([]);
});

it.each(["wolf", "wraith"] as const)(
  "lets a %s wind up and land one hit on an adult",
  (species) => {
    const w = createWorld(0);
    const [victim, child] = w.villagers;
    victim.x = 13;
    victim.y = 15;
    child.x = 12;
    child.y = 15;
    child.age = 8;
    w.tick = 200;
    w.disasters = [
      { kind: "monster", species, x: 12, y: 15, life: 100, people: [] },
    ];
    const attack = () =>
      apocalypse(
        w,
        () => 1,
        () => {},
      );
    attack();
    expect(w.disasters[0].people).toEqual([victim.id]);
    expect(victim.health).toBe(100);
    for (let i = 0; i < 5; i++) {
      w.tick++;
      attack();
    }
    expect(victim.health).toBe(100 - (species === "wolf" ? 3 : 4));
    expect(victim.hitAt).toBe(204);
    expect(child.health).toBe(100);
  },
);
