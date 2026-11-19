import { expect, it } from "vitest";
import { audioProfile } from "./village-audio";

it("fades daytime birds into dry wind and a late rumble", () => {
  const scene = { tick: 0, pressure: 0, water: 100 };
  const calm = audioProfile(scene);
  const drought = audioProfile({ ...scene, water: 35 });
  const collapse = audioProfile({ ...scene, water: 0, pressure: 95 });
  expect(calm.birds).toBe(1);
  expect(audioProfile({ ...scene, tick: 192 }).birds).toBe(0);
  expect(drought.birds).toBeLessThan(calm.birds);
  expect(drought.wind).toBeGreaterThan(calm.wind);
  expect(calm.drone).toBe(0);
  expect(collapse.drone).toBeGreaterThan(drought.drone);
  expect(collapse.birds).toBe(0);
});

it("only maps active incidents and keeps the latest creature strike", () => {
  const event = { x: 2, y: 4, life: 30, people: [] };
  const profile = audioProfile({
    pressure: 90,
    water: 0,
    tick: 300,
    disasters: [
      { ...event, kind: "fire" },
      { ...event, kind: "fire", life: 0 },
      { ...event, kind: "quake" },
      { ...event, kind: "fight" },
      { ...event, kind: "monster", attackAt: 280 },
      { ...event, kind: "monster", attackAt: 290 },
    ],
  });
  expect(profile).toMatchObject({ fire: 1, quake: 1, combat: 1, strike: 290 });
});
