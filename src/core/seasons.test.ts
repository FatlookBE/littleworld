import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import {
  autumnColour,
  daysToNextSeason,
  isWet,
  season,
  seasonalWeather,
  seasonNames,
  snowCover,
} from "./seasons";

const day = 288;

it("cycles through four seasons of four days, starting in spring", () => {
  expect(seasonNames[season(0)]).toBe("Printemps");
  expect(seasonNames[season(day * 4)]).toBe("Été");
  expect(seasonNames[season(day * 8)]).toBe("Automne");
  expect(seasonNames[season(day * 12)]).toBe("Hiver");
  expect(seasonNames[season(day * 16)]).toBe("Printemps");
});

it("lets snow settle in winter and melt in spring; leaves turn in autumn", () => {
  expect(snowCover(day * 6)).toBe(0);
  expect(snowCover(day * 14)).toBe(1);
  expect(snowCover(day * 16 + 10)).toBeGreaterThan(0.5);
  expect(snowCover(day * 17)).toBe(0);
  expect(autumnColour(day * 10)).toBe(1);
  expect(autumnColour(day * 2)).toBe(0);
});

it("snows instead of raining in winter, and either one counts as wet", () => {
  const w = createWorld(0);
  const kinds = new Set<string>();
  for (let t = day * 12; t < day * 16; t += 150) {
    w.tick = t;
    w.weather = seasonalWeather(w, 0);
    kinds.add(w.weather);
    if (w.weather === "Neige légère") expect(isWet(w)).toBe(true);
  }
  expect(kinds.has("Neige légère")).toBe(true);
  expect(kinds.has("Pluie légère")).toBe(false);
});

it("announces each new season in the chronicle", () => {
  const w = createWorld(0);
  w.tick = day * 4 - 1;
  step(w);
  expect(w.chronicle[0].text).toContain("été");
});

it("residents stop walking to the riverside pools once the river is dry", () => {
  const w = createWorld(0);
  w.water = 3;
  const v = w.villagers[0];
  v.x = 4.5;
  v.y = 22.5;
  v.thirst = 70;
  v.route = [];
  v.nextDecision = 0;
  step(w);
  expect(v.action).toContain("puits");
});

it("counts the village days left in the current season", () => {
  expect(daysToNextSeason(0)).toBe(4);
  expect(daysToNextSeason(day * 3 + 10)).toBe(1);
  expect(daysToNextSeason(day * 4)).toBe(4);
});

it("writes a chronicle line when a season begins", () => {
  const w = createWorld(0);
  w.tick = day * 4 - 1;
  step(w);
  expect(w.chronicle[0].text).toContain("L’été");
});
