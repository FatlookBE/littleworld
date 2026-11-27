import { expect, it } from "vitest";
import { riverSwallows, riverWatch } from "./swallow-river";
import { riverCenter, riverHalfWidth } from "./core/navigation";

const clear = { tick: 1199, weather: "Ciel clair", water: 70, pressure: 10 };

it("follows the actual bends and gradually descends then climbs", () => {
  const morning = riverSwallows(clear, 1194)[0];
  const midday = riverSwallows(clear, 1208);
  const end = riverSwallows(clear, 1222)[0];
  expect(midday).toHaveLength(2);
  expect(midday[0].y).toBeGreaterThan(morning.y);
  expect(end.y).toBeGreaterThan(midday[0].y);
  expect(midday[0].z).toBeLessThan(morning.z);
  expect(midday[0].z).toBeLessThan(end.z);
  expect(midday[0].y).not.toBe(midday[1].y);
  for (const b of [morning, ...midday, end])
    expect(Math.abs(b.x - riverCenter(b.y))).toBeLessThan(
      riverHalfWidth(clear),
    );
});

it("only appears during a short, sunny, healthy warm-season window", () => {
  expect(riverSwallows(clear, 1180)).toEqual([]);
  expect(riverSwallows(clear, 1230)).toEqual([]);
  expect(riverSwallows({ ...clear, weather: "Pluie légère" })).toEqual([]);
  expect(riverSwallows({ ...clear, weather: "Vent de poussière" })).toEqual([]);
  expect(riverSwallows({ ...clear, water: 30 })).toEqual([]);
  expect(riverSwallows({ ...clear, pressure: 68 })).toEqual([]);
  expect(riverSwallows({ ...clear, tick: 50 })).toEqual([]);
  expect(riverSwallows({ ...clear, tick: 3509 })).toEqual([]);
  expect(riverSwallows({ ...clear, tick: 624 })).not.toEqual([]);
});

it("fades near the ends of the route and as the river dries", () => {
  expect(riverSwallows(clear, 1192)[0].visibility).toBeLessThan(1);
  expect(riverSwallows(clear, 1208)[0].visibility).toBe(1);
  expect(
    riverSwallows({ ...clear, water: 50 }, 1208)[0].visibility,
  ).toBeLessThan(0.5);
});

it("reports the current activity and frames the flying birds along the river", () => {
  const w = { ...clear, tick: 1208, settings: { reducedMotion: false } };
  const birds = riverSwallows(w);
  const target = riverWatch(w);
  expect(target.status).toBe("active");
  expect(target.y).toBeCloseTo((birds[0].y + birds[1].y) / 2);
  expect(target.x).toBe(riverCenter(target.y));
  expect(riverWatch({ ...w, tick: 1180 }).status).toBe("upcoming");
  expect(riverWatch({ ...w, tick: 1230 }).status).toBe("over");
});

it("explains why no flight can be seen without changing the river viewpoint", () => {
  const w = { ...clear, tick: 1208, settings: { reducedMotion: false } };
  const dry = riverWatch({ ...w, water: 45 });
  expect(dry.status).toBe("water");
  expect(riverWatch({ ...w, tick: 10 }).status).toBe("season");
  expect(riverWatch({ ...w, weather: "Pluie légère" })).toEqual({
    ...dry,
    status: "weather",
  });
  expect(riverWatch({ ...w, pressure: 64 })).toEqual({
    ...dry,
    status: "pressure",
  });
  expect(riverWatch({ ...w, settings: { reducedMotion: true } })).toEqual({
    ...dry,
    status: "motion",
  });
});
