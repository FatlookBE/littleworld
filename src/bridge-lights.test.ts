import { expect, it } from "vitest";
import { bridgeLight, bridgeLanternSites } from "./bridge-lights";
import { createWorld } from "./core/engine";
import { riverCenter } from "./core/navigation";
import { storyTraces } from "./story-scene";

function ready() {
  const w = createWorld(0);
  w.stories = {
    nextAt: 1000,
    finished: ["lanterns", "cistern"],
    traces: ["lanterns", "cistern"],
  };
  return w;
}

it("unlocks the lanterns only after the successful outcome, not during the active or finished failed story", () => {
  const w = ready();
  w.tick = 172;
  delete w.stories!.traces;
  w.stories!.active = { id: "lanterns", phase: 1, due: 180, person: 0 };
  expect(bridgeLight(w)).toBeNull();
  delete w.stories!.active;
  expect(bridgeLight(w)).toBeNull();
});

it("brightens through dusk, goes out at dawn and repeats the next evening", () => {
  const w = ready();
  for (const [tick, strength] of [
    [120, 0],
    [162, 1],
    [288, 0],
    [450, 1],
  ]) {
    w.tick = tick;
    expect(bridgeLight(w)?.strength).toBe(strength);
  }
  w.tick = 139;
  expect(bridgeLight(w)?.strength).toBeGreaterThan(0);
  expect(bridgeLight(w)?.strength).toBeLessThan(1);
});

it("goes dark in dust, if the workshop cannot maintain it or no adult remains, and relights when conditions improve", () => {
  const w = ready();
  w.tick = 180;
  w.weather = "Vent de poussière";
  expect(bridgeLight(w)?.strength).toBe(0);
  w.weather = "Ciel clair";
  w.buildings[14].condition = 24;
  expect(bridgeLight(w)?.strength).toBe(0);
  w.buildings[14].condition = 50;
  expect(bridgeLight(w)?.strength).toBe(1);
  for (const v of w.villagers) v.dead = true;
  expect(bridgeLight(w)?.strength).toBe(0);
});

it("places two props on opposite banks and away from the story keepsakes", () => {
  const w = ready();
  const [left, right] = bridgeLanternSites;
  expect(left[0]).toBeLessThan(riverCenter(left[1]) - 1.9);
  expect(right[0]).toBeGreaterThan(riverCenter(right[1]) + 1.9);
  for (const [x, y] of bridgeLanternSites)
    for (const prop of storyTraces(w))
      expect(Math.hypot(x - prop.x, y - prop.y)).toBeGreaterThan(1.5);
});
