import { expect, it } from "vitest";
import type { Disaster } from "./core/apocalypse";
import { createWorld } from "./core/engine";
import { walkable } from "./core/navigation";
import { fieldAlarm, HenAlarm } from "./hen-alarm";
import { villageHens } from "./hens";

const fire = (x: number, y: number, life = 80): Disaster => ({
  kind: "fire",
  x,
  y,
  life,
  people: [],
});

it("ignores expired, non-threatening and remote events", () => {
  expect(fieldAlarm({ disasters: [fire(10, 21, 0), fire(22, 21)] })).toBeNull();
  expect(
    fieldAlarm({ disasters: [{ ...fire(10, 21), kind: "fight" }] }),
  ).toBeNull();
});

it("chooses the refuge away from nearby danger and labels its cause", () => {
  expect(fieldAlarm({ disasters: [fire(10, 20)] })).toMatchObject({
    refuge: "south",
    label: expect.stringContaining("fumée"),
  });
  const monster = { ...fire(10, 25), kind: "monster" } as const;
  expect(fieldAlarm({ disasters: [monster] })).toMatchObject({
    refuge: "north",
    label: expect.stringContaining("créature"),
  });
});

it("moves toward the refuge on the village clock and resumes the normal routine", () => {
  const hens = villageHens(0, 0, false, false);
  const rhythm = new HenAlarm();
  const alarm = fieldAlarm({ disasters: [fire(10, 20)] });
  expect(rhythm.place(hens, null, 5, false)).toBe(hens);
  const early = rhythm.place(hens, alarm, 5.5, false);
  expect(early[0].x).toBeGreaterThan(hens[0].x);
  expect(early[0].x).toBeLessThan(12.65);
  expect(rhythm.place(hens, alarm, 5.5, false)).toEqual(early);
  const settled = rhythm.place(hens, alarm, 7.1, false);
  expect(
    settled.every((hen) => hen.x >= 12.65 && hen.y >= 25.9 && hen.frame === 0),
  ).toBe(true);
  expect(rhythm.place(hens, null, 7.5, false)[0].x).toBeLessThan(settled[0].x);
  expect(rhythm.place(hens, null, 10.7, false)).toBe(hens);
});

it("shows the same four sprites at dry, walkable spots without motion", () => {
  const w = createWorld(0);
  const hens = villageHens(0, 1, true, true);
  for (const y of [20, 25]) {
    const alarm = fieldAlarm({ disasters: [fire(10, y)] });
    const rhythm = new HenAlarm();
    const settled = rhythm.place(hens, alarm, 5, true);
    expect(rhythm.place(hens, alarm, 6, true)).toEqual(settled);
    expect(
      settled.every(
        (hen) =>
          hen.frame === 0 && walkable(w, Math.floor(hen.x), Math.floor(hen.y)),
      ),
    ).toBe(true);
    expect(new Set(settled.map((hen) => [hen.x, hen.y].join())).size).toBe(4);
    expect(rhythm.place(hens, null, 7, true)).toBe(hens);
  }
});
