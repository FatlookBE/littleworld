import { expect, it } from "vitest";
import { createWorld, newSession, note, step } from "./engine";
import { restore } from "./persistence";
import type { World } from "./types";
import { advanceVillageStories, contributeToStory, storyAid } from "./village-stories";

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

function contribute(w: World, id: Parameters<typeof contributeToStory>[1]) {
  return contributeToStory(w, id, (text, kind, person) => note(w, text, kind, person));
}

it("lets player aid tip the cistern outcome, charges once and persists the decision", () => {
  const w = dryWorld();
  w.cooperation = 37;
  advance(w, 240);
  expect(storyAid(w)).toBeNull();
  expect(contribute(w, "cistern")).toBe(false);
  advance(w, 282);
  const unhelped = structuredClone(w);
  const food = w.food;
  expect(contribute(w, "seed-cache")).toBe(false);
  expect(contribute(w, "cistern")).toBe(true);
  expect(w.food).toBe(food - 3);
  expect(w.cooperation).toBe(45);
  const restored = restore(JSON.stringify(w));
  expect(storyAid(restored)?.contributed).toBe(true);
  expect(contribute(restored, "cistern")).toBe(false);
  expect(restored.food).toBe(food - 3);
  advance(restored, 340);
  advance(unhelped, 340);
  expect(restored.water).toBe(58);
  expect(unhelped.water).toBe(48);
  expect(storyAid(restored)).toBeNull();
});

it("rejects unaffordable or expired actions without side effects", () => {
  const w = dryWorld();
  advance(w, 240);
  advance(w, 282);
  const before = w.chronicle.length;
  w.food = 2;
  expect(storyAid(w)?.affordable).toBe(false);
  expect(contribute(w, "cistern")).toBe(false);
  expect(w.food).toBe(2);
  w.food = 25;
  w.tick = 340;
  expect(contribute(w, "cistern")).toBe(false);
  expect(w.food).toBe(25);
  expect(w.chronicle).toHaveLength(before);
});

it("offers different aid for seeds and lanterns", () => {
  const seeds = dryWorld();
  seeds.water = 70;
  seeds.food = 40;
  advance(seeds, 240);
  advance(seeds, 282);
  expect(storyAid(seeds)).toMatchObject({ id: "seed-cache", resource: "water", cost: 4 });
  expect(contribute(seeds, "seed-cache")).toBe(true);
  expect(seeds.water).toBe(66);

  const lanterns = createWorld(0);
  advance(lanterns, 240);
  advance(lanterns, 282);
  expect(storyAid(lanterns)).toMatchObject({ id: "lanterns", resource: "food", cost: 2 });
});

it("discovers the forgotten starter in autumn and lets an offering make the bake happen", () => {
  const w = createWorld(0);
  w.stories = { nextAt: 0, finished: ["cistern", "seed-cache", "lanterns"] };
  w.cooperation = 44;
  const autumn = 2 * 4 * 288;
  advance(w, autumn - 24);
  expect(w.stories.active).toBeUndefined();
  advance(w, autumn);
  expect(w.stories.active).toMatchObject({ id: "lost-starter", phase: 0 });
  expect(w.chronicle[0].text).toContain("pot gravé");
  advance(w, autumn + 42);
  const unfunded = restore(JSON.stringify(w));
  const water = w.water;
  const food = w.food;
  expect(contribute(w, "lost-starter")).toBe(true);
  expect(w.water).toBe(water - 3);
  advance(w, autumn + 100);
  advance(unfunded, autumn + 100);
  expect(w.chronicle[0].text).toContain("premiers pains");
  expect(w.food).toBe(food - 4);
  expect(w.cooperation).toBe(58);
  expect(unfunded.chronicle[0].text).toContain("attendra");
  expect(unfunded.food).toBe(food);
  expect(restore(JSON.stringify(w)).stories?.finished).toContain("lost-starter");
});

it("waits for a usable bakery before starting the autumn story", () => {
  const w = createWorld(0);
  const bakery = w.buildings.find((b) => b.type === "bakery")!;
  w.stories = { nextAt: 0, finished: ["cistern", "seed-cache", "lanterns"] };
  bakery.condition = 34;
  const autumn = 2 * 4 * 288;
  advance(w, autumn);
  expect(w.stories.active).toBeUndefined();
  bakery.condition = 36;
  advance(w, autumn + 24);
  expect(w.stories.active).toMatchObject({ id: "lost-starter" });
});

it("keeps earned traces across reloads without guessing outcomes for old saves", () => {
  const w = dryWorld();
  for (const tick of [240, 282, 340]) advance(w, tick);
  expect(restore(JSON.stringify(w)).stories?.traces).toEqual(["cistern"]);
  delete w.stories!.traces;
  expect(restore(JSON.stringify(w)).stories?.traces).toBeUndefined();
  w.stories!.traces = ["lanterns"];
  expect(() => restore(JSON.stringify(w))).toThrow("Structure de sauvegarde invalide");
});

it("adds no trace when the village seals the cistern", () => {
  const w = dryWorld();
  w.cooperation = 20;
  for (const tick of [240, 282, 340]) advance(w, tick);
  expect(w.stories?.finished).toEqual(["cistern"]);
  expect(w.stories?.traces).toBeUndefined();
});
