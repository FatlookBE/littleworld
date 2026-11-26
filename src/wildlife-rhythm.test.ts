import { expect, it } from "vitest";
import { foragingHens, villageHens } from "./hens";
import { WildlifeRhythm, wildlifeTargets } from "./wildlife-rhythm";

const summerDay = { tick: 4 * 288 + 72, weather: "Ciel clair", pressure: 0 };

it("brings swallows out by day, fades them out in autumn, and keeps winter skies clear", () => {
  expect(wildlifeTargets(summerDay)).toEqual({ shelter: false, flight: 1 });
  const earlyAutumn = wildlifeTargets({ ...summerDay, tick: 8 * 288 + 72 });
  const lateAutumn = wildlifeTargets({ ...summerDay, tick: 10 * 288 + 72 });
  expect(earlyAutumn.flight).toBeGreaterThan(0);
  expect(earlyAutumn.flight).toBeLessThan(1);
  expect(lateAutumn.flight).toBe(0);
  expect(wildlifeTargets({ ...summerDay, tick: 12 * 288 + 72 }).flight).toBe(0);
  expect(wildlifeTargets({ ...summerDay, tick: 16 * 288 + 2 * 288 + 72 }).flight).toBe(1);
});

it("seeks cover in rain, snow, dust and at night, but not under clear daylight", () => {
  for (const weather of ["Pluie légère", "Neige légère", "Vent de poussière"]) {
    expect(wildlifeTargets({ ...summerDay, weather })).toEqual({ shelter: true, flight: 0 });
  }
  expect(wildlifeTargets({ ...summerDay, tick: 4 * 288 + 216 })).toEqual({ shelter: true, flight: 0 });
  expect(wildlifeTargets({ ...summerDay, pressure: 59 }).flight).toBeCloseTo(0.5);
});

it("fades and moves gradually in village time, including a paused frame, then returns", () => {
  const wild = new WildlifeRhythm();
  const rain = { ...summerDay, weather: "Pluie légère" };
  wild.update(summerDay, 19, false);
  wild.update(rain, 19.5, false);
  expect(wild.cover).toBeCloseTo(0.17);
  expect(wild.flight).toBeCloseTo(0.64);
  wild.update(rain, 19.5, false);
  expect(wild.cover).toBeCloseTo(0.17);
  wild.update(rain, 22.8, false);
  expect(wild.cover).toBe(1);
  expect(wild.flight).toBe(0);
  wild.update(summerDay, 23, false);
  expect(wild.headingToCover).toBe(false);
  expect(wild.cover).toBeGreaterThan(0.9);
  wild.update(summerDay, 26.2, false);
  expect(wild.cover).toBe(0);
  expect(wild.flight).toBe(1);
});

it("settles four hens in separate stationary spots and supports reduced motion and resets", () => {
  expect(villageHens(3, 0, false, false)).toEqual(foragingHens(3));
  const settled = villageHens(10, 1, true, false);
  expect(settled).toEqual(villageHens(120, 1, true, false));
  expect(settled.every((v) => v.y < 21 && v.frame === 0)).toBe(true);
  expect(new Set(settled.map((v) => v.x)).size).toBe(4);
  expect(villageHens(120, 1, true, true)).toEqual(settled);
  const wild = new WildlifeRhythm();
  wild.update(summerDay, 20, false);
  wild.update({ ...summerDay, weather: "Pluie légère" }, 20, true);
  expect(wild.cover).toBe(1);
  wild.update(summerDay, 0, false);
  expect(wild.cover).toBe(0);
});
