import { describe, expect, it } from "vitest";
import { createWorld, newSession, step } from "./engine";
import { restore } from "./persistence";
import { bakeryState, finishDailyBread } from "./bakery";

function setup() {
  const w = createWorld(0);
  w.tick = 70;
  const bakery = w.buildings[11];
  const baker = w.villagers[1];
  const x = bakery.x + 0.5;
  const y = bakery.y + 2.5;
  Object.assign(baker, {
    x,
    y,
    target: [x, y],
    route: [],
    action: "Pétrit le pain",
    actionAt: w.tick - 14,
    nextDecision: 500,
  });
  w.water = 40;
  w.food = 50;
  return { w, bakery, baker };
}

describe("daily bread", () => {
  it("converts water to food only after an adult has kneaded on site", () => {
    const { w, baker, bakery } = setup();
    baker.actionAt = w.tick - 13;
    expect(finishDailyBread(w)).toBeNull();
    w.tick++;
    expect(finishDailyBread(w)?.baker).toBe(baker);
    expect([w.food, w.water]).toEqual([55, 38]);
    expect(bakeryState(w, bakery)?.fresh).toBe(true);
    expect(finishDailyBread(w)).toBeNull();
    w.tick += 36;
    expect(bakeryState(w, bakery)?.fresh).toBe(false);
    w.tick += 288;
    expect(finishDailyBread(w)).not.toBeNull();
  });

  it.each([
    "walking",
    "far",
    "night",
    "danger",
    "damage",
    "no water",
    "poor land",
    "full",
    "child",
  ])("cannot finish while %s", (caseName) => {
    const { w, baker, bakery } = setup();
    if (caseName === "walking") baker.route = [[10, 11]];
    if (caseName === "far")
      Object.assign(baker, { target: [23, 25], x: 23, y: 25 });
    if (caseName === "night") w.tick = 162;
    if (caseName === "danger")
      w.disasters = [
        { kind: "fire", x: bakery.x, y: bakery.y, life: 50, people: [] },
      ];
    if (caseName === "damage") bakery.condition = 20;
    if (caseName === "no water") w.water = 26;
    if (caseName === "poor land") w.fertility = 25;
    if (caseName === "full") w.food = 97;
    if (caseName === "child") baker.age = 12;
    expect(finishDailyBread(w)).toBeNull();
    expect(w.breadBakedAt).toBeUndefined();
  });

  it("records the batch in the bakery and baker memories, survives reload and resets only for a fresh world", () => {
    const { w, bakery, baker } = setup();
    step(w);
    expect(w.breadBakedAt).toBe(w.tick);
    expect(bakery.events[0]).toBe(baker.memories[0]);
    expect(w.chronicle[0]).toBe(bakery.events[0]);
    const restored = restore(JSON.stringify(w));
    expect(restored.breadBakedAt).toBe(w.tick);
    newSession(restored, 1);
    expect(restored.breadBakedAt).toBe(w.tick);
    restored.settings.scenario = "session";
    newSession(restored, 2);
    expect(restored.breadBakedAt).toBeUndefined();
  });

  it("occurs during normal autonomous village activity", () => {
    const w = createWorld(0);
    for (let i = 0; i < 288 * 3 && w.breadBakedAt === undefined; i++) step(w);
    expect(w.breadBakedAt).toBeDefined();
    expect(
      w.buildings[11].events.some((e) => e.text.includes("sort le pain")),
    ).toBe(true);
  });
});
