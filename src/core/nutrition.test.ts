import { expect, it } from "vitest";
import { createWorld } from "./engine";
import { restore } from "./persistence";
import { nutritionStage, updateNutrition } from "./nutrition";
it("prolonged hunger causes lasting wasting, with slow recovery after meals", () => {
  const v = createWorld(0).villagers[0];
  v.hunger = 100;
  updateNutrition(v);
  expect(nutritionStage(v)).toBe(0);
  for (let i = 0; i < 60; i++) updateNutrition(v);
  expect(nutritionStage(v)).toBe(1);
  for (let i = 0; i < 100; i++) updateNutrition(v);
  expect(nutritionStage(v)).toBe(2);
  const before = v.malnutrition!;
  v.hunger = 10;
  updateNutrition(v);
  expect(v.malnutrition).toBeLessThan(before);
  expect(nutritionStage(v)).toBe(2);
  for (let i = 0; i < 1200; i++) updateNutrition(v);
  expect(v.malnutrition).toBe(0);
});
it("keeps fed villagers healthy and freezes the state after death", () => {
  const v = createWorld(0).villagers[0];
  for (let i = 0; i < 1000; i++) updateNutrition(v);
  expect(v.malnutrition).toBe(0);
  v.dead = true;
  v.hunger = 100;
  updateNutrition(v);
  expect(v.malnutrition).toBe(0);
});
it("preserves wasting in saves, accepts legacy saves and rejects invalid values", () => {
  const w = createWorld(0);
  w.villagers[0].malnutrition = 75;
  expect(restore(JSON.stringify(w)).villagers[0].malnutrition).toBe(75);
  delete w.villagers[0].malnutrition;
  expect(nutritionStage(restore(JSON.stringify(w)).villagers[0])).toBe(0);
  w.villagers[0].malnutrition = -1;
  expect(() => restore(JSON.stringify(w))).toThrow();
});
