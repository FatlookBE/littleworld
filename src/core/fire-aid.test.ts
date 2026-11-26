import { expect, it } from "vitest";
import { apocalypse, type Disaster } from "./apocalypse";
import { createWorld, supportFireCrew } from "./engine";
import { fireAid, sendFireWater } from "./fire-aid";
import { restore } from "./persistence";

function villageOnFire(life = 400) {
  const w = createWorld(0);
  w.tick = 119;
  w.water = 40;
  const site = w.buildings[1];
  const fire: Disaster = { kind: "fire", x: site.x, y: site.y, life, people: [] };
  w.disasters = [fire];
  return { w, site, fire };
}

it("spends five water on one site, shortens the fire, and remembers the action", () => {
  const { w, site, fire } = villageOnFire();
  expect(fireAid(w, w.buildings[0])).toBeNull();
  expect(supportFireCrew(w, site.id)).toContain(site.name);
  expect(w.water).toBe(35);
  expect(fire.life).toBe(310);
  const loaded = restore(JSON.stringify(w));
  expect(loaded.buildings[site.id].events[0]).toEqual(loaded.chronicle[0]);
  expect(supportFireCrew(loaded, site.id)).toBeNull();
  expect(loaded.water).toBe(35);
  expect(loaded.usage).toEqual([]);
});

it("does not affect other fires and leaves some water in the reservoir", () => {
  const { w, site, fire } = villageOnFire();
  const other = w.buildings[2];
  w.disasters!.push({ kind: "fire", x: other.x, y: other.y, life: 125, people: [] });
  w.water = 8.99;
  expect(sendFireWater(w, site.id)).toBeNull();
  expect(fire.waterAidTicks).toBeUndefined();
  w.water = 9;
  expect(sendFireWater(w, site.id)).toBe(site);
  expect(w.water).toBe(4);
  expect(w.disasters![1].life).toBe(125);
});

it("does not extinguish instantly or make a fresh supported fire spread earlier", () => {
  const { w, site, fire } = villageOnFire(400);
  w.moisture = 0;
  for (const v of w.villagers) v.x = v.y = 28;
  sendFireWater(w, site.id);
  w.tick = 120;
  apocalypse(w, () => 0, () => {});
  expect(w.disasters).toHaveLength(1);
  fire.life = 8;
  delete fire.waterAidTicks;
  sendFireWater(w, site.id);
  expect(fire.life).toBe(4);
});

it("rejects malformed fire assistance flags without affecting old saves", () => {
  const { w, fire } = villageOnFire();
  expect(restore(JSON.stringify(w)).disasters?.[0].waterAidTicks).toBeUndefined();
  for (const value of [0, 999, 1.5, "12", true])
    expect(() => restore(JSON.stringify({ ...w, disasters: [{ ...fire, waterAidTicks: value }] })))
      .toThrow("Catastrophes invalides");
  expect(() => restore(JSON.stringify({ ...w, disasters: [{ ...fire, kind: "blight", waterAidTicks: 12 }] })))
    .toThrow("Catastrophes invalides");
});
