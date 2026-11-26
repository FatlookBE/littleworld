import { expect, it } from "vitest";
import { createWorld, harvestRainwater, newSession } from "./engine";
import { restore } from "./persistence";
import { collectRainwater, rainCollection } from "./rain-collection";
import { WEATHER_SLOT_TICKS } from "./seasons";

function rainyVillage() {
  const w = createWorld(0);
  w.tick = WEATHER_SLOT_TICKS + 1;
  w.weather = "Pluie légère";
  w.water = 41;
  const site = w.buildings.find((b) => b.type === "reservoir")!;
  return { w, site };
}

it("adds water once in a rainy slot, even after reload or a brief dry interval", () => {
  const { w, site } = rainyVillage();
  expect(rainCollection(w, site)).toMatchObject({ visible: true, amount: 8, unavailable: null });
  expect(collectRainwater(w, site.id)?.amount).toBe(8);
  expect(w.water).toBe(49);
  w.weather = "Vent de poussière";
  expect(collectRainwater(w, site.id)).toBeNull();
  const loaded = restore(JSON.stringify(w));
  loaded.tick += 30;
  loaded.weather = "Pluie légère";
  expect(collectRainwater(loaded, site.id)).toBeNull();
  expect(loaded.water).toBe(49);
  loaded.tick = 3 * WEATHER_SLOT_TICKS;
  expect(collectRainwater(loaded, site.id)?.amount).toBe(8);
  expect(loaded.water).toBe(57);
  expect(loaded.usage).toEqual([]);
});

it("does not use a slot in snow, at the wrong building, or with a broken reservoir", () => {
  const { w, site } = rainyVillage();
  w.weather = "Neige légère";
  expect(rainCollection(w, site)?.visible).toBe(false);
  expect(collectRainwater(w, site.id)).toBeNull();
  w.weather = "Pluie légère";
  expect(collectRainwater(w, 0)).toBeNull();
  site.condition = 34;
  expect(rainCollection(w, site)?.visible).toBe(false);
  expect(collectRainwater(w, site.id)).toBeNull();
  expect(w.rainCollectedAt).toBeUndefined();
  expect(w.water).toBe(41);
});

it("does not mark a full reservoir as collected and only adds water it can hold", () => {
  const { w, site } = rainyVillage();
  w.water = 100;
  expect(collectRainwater(w, site.id)).toBeNull();
  expect(w.rainCollectedAt).toBeUndefined();
  w.water = 97;
  expect(collectRainwater(w, site.id)?.amount).toBe(3);
  expect(w.water).toBe(100);
});

it("accepts old saves, rejects invalid collection timestamps, and clears the slot on reset", () => {
  const { w, site } = rainyVillage();
  expect(restore(JSON.stringify(w)).rainCollectedAt).toBeUndefined();
  for (const value of [w.tick + 1, -1, 1.25, "151", null]) {
    expect(() => restore(JSON.stringify({ ...w, rainCollectedAt: value })))
      .toThrow("Structure de sauvegarde invalide");
  }
  collectRainwater(w, site.id);
  w.settings.scenario = "session";
  newSession(w, 1);
  expect(w.rainCollectedAt).toBeUndefined();
});


it("records the catch in the chronicle and at the reservoir without overflowing its history", () => {
  const { w, site } = rainyVillage();
  site.events = Array.from({ length: 12 }, () => ({ tick: 0, text: "Avant la pluie.", kind: "ordinary" }));
  expect(harvestRainwater(w, site.id)).toContain("+8 points d’eau");
  expect(harvestRainwater(w, site.id)).toBeNull();
  const loaded = restore(JSON.stringify(w));
  expect(loaded.buildings[site.id].events).toHaveLength(12);
  expect(loaded.buildings[site.id].events[0]).toEqual(loaded.chronicle[0]);
});
