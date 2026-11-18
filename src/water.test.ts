import { expect, it } from "vitest";
import { riverHalfWidth } from "./core/navigation";
import { WaterLevel, waterHalfWidth } from "./water";

it("never draws water outside the channel residents avoid", () => {
  for (let level = 0; level <= 100; level += 5)
    for (let y = -1; y <= 30; y += 0.25)
      expect(waterHalfWidth(level, y)).toBeLessThanOrEqual(
        riverHalfWidth({ water: level }) + 1e-9,
      );
});

it("narrows continuously and leaves isolated pools before drying out", () => {
  const rows = Array.from({ length: 116 }, (_, i) => i * 0.25);
  const wetRows = (level: number) =>
    rows.filter((y) => waterHalfWidth(level, y) > 0).length;
  expect(wetRows(100)).toBe(rows.length);
  expect(wetRows(3)).toBeGreaterThan(0);
  expect(wetRows(3)).toBeLessThan(rows.length);
  expect(wetRows(0)).toBe(0);
  for (const y of rows)
    expect(waterHalfWidth(40, y)).toBeLessThanOrEqual(waterHalfWidth(41, y));
});

it("eases the displayed reserve towards the simulation and keeps banks damp", () => {
  const level = new WaterLevel();
  level.update(80, 0);
  expect(level.shown).toBe(80);
  level.update(70, 0.2);
  expect(level.shown!).toBeLessThan(80);
  expect(level.shown!).toBeGreaterThan(70);
  for (let t = 0.4; t < 10; t += 0.2) level.update(70, t);
  expect(level.shown!).toBeCloseTo(70, 1);
  level.update(40, 10.2, true);
  expect(level.shown).toBe(40);
  // Paused clock: nothing moves.
  level.update(20, 10.2);
  expect(level.shown).toBe(40);
});

it("lets uncovered silt dry over simulated time", () => {
  const level = new WaterLevel();
  level.update(60, 0);
  for (let t = 0.2; t <= 4; t += 0.2) level.update(45, t);
  expect(level.wet).toBeGreaterThan(level.shown!);
  for (let t = 4.2; t <= 40; t += 0.2) level.update(45, t);
  expect(level.wet).toBeCloseTo(level.shown!, 3);
});
