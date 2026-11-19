import { expect, it } from "vitest";
import { createWorld } from "./engine";
import { buildingCauses, personCauses, villageCauses } from "./village-causes";

it("distinguishes pressure on still-fertile crops from a dry soil diagnosis", () => {
  const w = createWorld(1);
  w.pressure = 55;
  w.moisture = 90;
  w.fertility = 90;
  expect(villageCauses(w).map((c) => c.id)).toContain("harvest");
  expect(villageCauses(w).map((c) => c.id)).not.toContain("soil");
  w.moisture = 30;
  expect(villageCauses(w).map((c) => c.id)).toContain("soil");
});
it("prioritizes concrete active fires and does not diagnose a distant building as burning", () => {
  const w = createWorld(1),
    b = w.buildings[0];
  w.disasters = [
    { kind: "fire", x: b.x + 10, y: b.y + 10, life: 50, people: [] },
  ];
  expect(villageCauses(w)[0].id).toBe("fire");
  expect(buildingCauses(w, b).map((c) => c.id)).not.toContain("fire");
  w.disasters[0].x = b.x;
  w.disasters[0].y = b.y;
  expect(buildingCauses(w, b)[0].id).toBe("fire");
  w.disasters[0].life = 0;
  expect(buildingCauses(w, b).map((c) => c.id)).not.toContain("fire");
});
it("explains malnutrition recovery separately from dangerous immediate hunger", () => {
  const w = createWorld(1),
    v = w.villagers[0];
  v.malnutrition = 80;
  v.hunger = 10;
  v.thirst = 10;
  expect(personCauses(w, v).map((c) => c.id)).toEqual(["nutrition"]);
  expect(personCauses(w, v)[0].detail).toContain("à nouveau nourri");
  v.hunger = 95;
  expect(personCauses(w, v)[0].id).toBe("health");
  expect(personCauses(w, v).map((c) => c.id)).toContain("hunger");
  v.dead = true;
  expect(personCauses(w, v).map((c) => c.id)).toEqual(["remains"]);
});
it("offers contextual upkeep only under the conditions that allow actual repair", () => {
  const w = createWorld(1),
    b = w.buildings[0];
  b.condition = 60;
  w.pressure = 10;
  expect(buildingCauses(w, b).map((c) => c.id)).toContain("upkeep");
  w.pressure = 40;
  expect(buildingCauses(w, b).map((c) => c.id)).not.toContain("upkeep");
  expect(buildingCauses(w, b).map((c) => c.id)).toContain("wear");
});
it("shows a sober stable state without changing the simulation or creating notices", () => {
  const w = createWorld(1),
    before = structuredClone(w);
  expect(villageCauses(w).map((c) => c.id)).toEqual(["stable"]);
  expect(personCauses(w, w.villagers[0])[0].id).toBe("ordinary");
  expect(buildingCauses(w, w.buildings[0])[0].id).toBe("sound");
  expect(w).toEqual(before);
});

it("does not attribute a low reserve to high pressure when pressure is absent", () => {
  const w = createWorld(1);
  w.pressure = 0;
  w.water = 20;
  const water = villageCauses(w).find((c) => c.id === "water")!;
  expect(water.title).toBe("La réserve d’eau est faible");
  expect(water.detail).not.toContain("La pression fictive réduit");
});
it("identifies low health without pretending current hunger caused the previous damage", () => {
  const w = createWorld(1),
    v = w.villagers[0];
  v.health = 15;
  v.hunger = v.thirst = 10;
  const causes = personCauses(w, v);
  expect(causes[0].id).toBe("recovery");
  expect(causes.map((c) => c.id)).not.toContain("health");
});
