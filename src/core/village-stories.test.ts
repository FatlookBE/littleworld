import { expect, it } from "vitest";
import { createWorld, newSession, note, step } from "./engine";
import { restore } from "./persistence";
import type { World } from "./types";
import { advanceVillageStories } from "./village-stories";

const advance = (w: World, tick: number) => {
  w.tick = tick;
  advanceVillageStories(w, (text, kind, person) => note(w, text, kind, person));
};

function dryWorld() {
  const w = createWorld(0);
  w.pressure = 45;
  w.water = 48;
  return w;
}

it("reveals a resource-dependent secret over time, without changing the shared RNG", () => {
  const w = dryWorld();
  const seed = w.seed;
  advance(w, 240);
  expect(w.chronicle[0].text).toContain("grille du pont");
  expect(w.chronicle[0].text).not.toContain("citerne");
  expect(w.water).toBe(48);
  const entries = w.chronicle.length;
  advance(w, 281);
  expect(w.chronicle).toHaveLength(entries);
  advance(w, 282);
  expect(w.chronicle[0].text).toContain("ancienne citerne");
  expect(w.water).toBe(48);
  advance(w, 340);
  expect(w.chronicle[0].kind).toBe("hope");
  expect(w.water).toBe(58);
  expect(w.cooperation).toBe(78);
  expect(w.seed).toBe(seed);
  expect(w.villagers[w.chronicle[0].person!].memories[0]).toEqual(
    w.chronicle[0],
  );
  advance(w, 1000);
  expect(
    w.chronicle.filter((event) => event.text.includes("grille du pont")),
  ).toHaveLength(1);
});

it("branches on the village’s condition when the last act happens", () => {
  const w = dryWorld();
  advance(w, 240);
  advance(w, 282);
  w.cooperation = 28;
  advance(w, 340);
  expect(w.chronicle[0].text).toContain("reste scellée");
  expect(w.water).toBe(48);
  expect(w.cooperation).toBe(26);
});

it("persists an unfinished arc, supports old saves and clears it on a fresh session", () => {
  const w = dryWorld();
  expect(restore(JSON.stringify(w)).stories).toBeUndefined();
  advance(w, 240);
  const save = restore(JSON.stringify(w));
  advance(w, 282);
  advance(save, 282);
  advance(w, 340);
  advance(save, 340);
  expect(save).toEqual(w);
  save.settings.scenario = "session";
  newSession(save, 1);
  expect(save.stories).toBeUndefined();
  expect(save.tick).toBe(0);
});

it("rejects malformed saves instead of trying to run unknown story rules", () => {
  const w = dryWorld();
  advance(w, 240);
  const save = JSON.stringify({
    ...w,
    stories: { ...w.stories, active: { id: "missing" } },
  });
  expect(() => restore(save)).toThrow("Structure de sauvegarde invalide");
});

it("continues an arc with a living adult if the original villager dies", () => {
  const w = dryWorld();
  advance(w, 240);
  const original = w.stories!.active!.person;
  w.villagers[original].dead = true;
  advance(w, 282);
  expect(w.chronicle[0].person).not.toBe(original);
  const replacement = w.chronicle[0].person;
  advance(w, 340);
  expect(w.chronicle[0].person).toBe(replacement);
});

it("starts a different story during ordinary play, with no token usage", () => {
  const w = createWorld(0);
  for (let i = 0; i < 400; i++) step(w);
  expect(w.usage).toHaveLength(0);
  expect(
    w.chronicle.some((event) => event.text.includes("code des lumières")),
  ).toBe(true);
});
