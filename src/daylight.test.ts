import { expect, it } from "vitest";
import { daylight, goldenHour, hourOf, TICKS_PER_DAY } from "./daylight";

it("follows the displayed clock: day at 8:00, night at midnight", () => {
  expect(hourOf(0)).toBe(8);
  expect(daylight(0)).toBe(1);
  expect(daylight(12 * 4)).toBe(1); // noon
  expect(daylight(12 * 16)).toBe(0); // midnight
  expect(daylight(12 * 16 + TICKS_PER_DAY)).toBe(0);
});

it("brightens and darkens gradually at dawn and dusk", () => {
  const dusk = [18, 19, 20, 21, 22].map((h) => daylight((h - 8) * 12));
  for (let i = 1; i < dusk.length; i++)
    expect(dusk[i]).toBeLessThanOrEqual(dusk[i - 1]);
  expect(goldenHour((19.5 - 8) * 12)).toBeGreaterThan(0.5);
  expect(goldenHour(0)).toBe(0);
});
