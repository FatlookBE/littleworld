import { expect, it } from "vitest";
import { createWorld } from "./engine";
import { restore } from "./persistence";
import { giveResidentAid, residentAidOptions } from "./resident-aid";

it("helps a thirsty resident at the expense of the shared reserve and persists the respite", () => {
  const world = createWorld(0);
  world.villagers[0].thirst = 68;
  const water = world.water;
  expect(giveResidentAid(world, 0, "water")).toContain("reçoit une gourde");
  expect(world.villagers[0].thirst).toBe(44);
  expect(world.water).toBe(water - 4);
  const restored = restore(JSON.stringify(world));
  restored.villagers[0].hunger = 70;
  expect(giveResidentAid(restored, 0, "food")).toBeNull();
  restored.tick = 60;
  expect(giveResidentAid(restored, 0, "food")).toContain("reçoit un repas");
  expect(restored.villagers[0].hunger).toBe(45);
  expect(restored.food).toBe(world.food - 5);
});

it("rejects unnecessary aid, low reserves and invalid or deceased recipients", () => {
  const world = createWorld(0);
  const resident = world.villagers[0];
  expect(giveResidentAid(world, 0, "water")).toBeNull();
  resident.thirst = 80;
  world.water = 3;
  expect(residentAidOptions(world, resident)[0].reason).toContain("réserves");
  expect(giveResidentAid(world, 0, "water")).toBeNull();
  expect(resident.thirst).toBe(80);
  expect(world.water).toBe(3);
  resident.dead = true;
  world.water = 90;
  expect(giveResidentAid(world, 0, "water")).toBeNull();
  expect(giveResidentAid(world, 100, "water")).toBeNull();
  expect(world.water).toBe(90);
});
