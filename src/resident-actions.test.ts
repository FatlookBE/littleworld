import { expect, it } from "vitest";
import { createWorld } from "./core/engine";
import { residentAction, residentActionTime } from "./resident-actions";

function scene(action: string) {
  const w = createWorld(0),
    v = w.villagers[0];
  v.action = action;
  v.target = [v.x, v.y];
  v.route = [];
  v.morale = 80;
  return { w, v };
}
it("plays the activity only after arrival, with travel and injury taking priority", () => {
  const { w, v } = scene("Cueille des plantes sauvages");
  expect(residentAction(v, w)).toBe("gather");
  v.route = [[v.x + 1, v.y]];
  expect(residentAction(v, w)).toBeNull();
  v.route = [];
  v.target = [v.x + 2, v.y];
  expect(residentAction(v, w)).toBeNull();
  v.target = [v.x, v.y];
  v.hitAt = w.tick;
  expect(residentAction(v, w)).toBeNull();
  v.hitAt = undefined;
  v.dead = true;
  expect(residentAction(v, w)).toBeNull();
});
it("does not show drinking or eating when resources are empty", () => {
  const { w, v } = scene("Attend son tour au puits");
  expect(residentAction(v, w)).toBe("drink");
  w.water = 0;
  expect(residentAction(v, w)).toBeNull();
  v.action = "Prend un repas avec ses provisions";
  expect(residentAction(v, w)).toBe("eat");
  w.food = 0;
  expect(residentAction(v, w)).toBeNull();
});
it("distinguishes manual work and gathering from unrelated actions", () => {
  const { w, v } = scene("Aide à l’atelier");
  expect(residentAction(v, w)).toBe("work");
  v.action = "Prend soin du verger";
  expect(residentAction(v, w)).toBe("gather");
  v.action = "Explore les berges";
  expect(residentAction(v, w)).toBeNull();
});

it("keeps an activity stop after a long journey instead of immediately rerouting", async () => {
  const { step } = await import("./core/engine");
  const { w, v } = scene("Cueille des plantes sauvages");
  v.route = [[v.x, v.y]];
  v.nextDecision = -100;
  v.thirst = 0;
  v.cooldown = 9999;
  step(w);
  expect(v.route).toHaveLength(0);
  expect(v.nextDecision).toBeGreaterThanOrEqual(w.tick + 24);
  step(w);
  expect(v.action).toBe("Cueille des plantes sauvages");
  expect(residentAction(v, w)).toBe("gather");
});

it("maps bread, care and water carrying to their distinct gesture sheets", () => {
  const { w, v } = scene("Pétrit le pain");
  expect(residentAction(v, w)).toBe("bake");
  v.action = "Soigne ses voisins";
  expect(residentAction(v, w)).toBe("care");
  v.action = "Porte de l’eau à ses voisins";
  v.route = [[v.x + 1, v.y]];
  expect(residentAction(v, w)).toBe("carry");
  w.water = 0;
  expect(residentAction(v, w)).toBeNull();
  v.route = [];
  v.action = "Pétrit le pain";
  w.food = 0;
  expect(residentAction(v, w)).toBeNull();
});
it("uses elapsed simulation time from arrival rather than a global arbitrary pose", () => {
  const { v } = scene("Pétrit le pain");
  v.actionAt = 150;
  expect(residentActionTime(v, 30)).toBe(0);
  expect(residentActionTime(v, 30.4)).toBeCloseTo(0.4);
  expect(residentActionTime(v, 29)).toBe(0);
});
it("does not animate work over a doorway passage or an interior visit", () => {
  const { w, v } = scene("Soigne ses voisins");
  v.visit = {
    building: v.home,
    phase: "inside",
    since: w.tick,
    until: w.tick + 20,
  };
  expect(residentAction(v, w)).toBeNull();
  v.visit.phase = "entering";
  expect(residentAction(v, w)).toBeNull();
});
