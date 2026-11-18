import { it, expect } from "vitest";
import { poses, residentPose } from "./sprites";
import { createWorld } from "./core/engine";
it("every authored crop stays in the original sheet with a valid foot anchor", () => {
  for (const frames of Object.values(poses))
    for (const f of frames) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w).toBeLessThanOrEqual(1536);
      expect(f.y + f.h).toBeLessThanOrEqual(1024);
      expect(f.footX).toBeGreaterThanOrEqual(0);
      expect(f.footX).toBeLessThanOrEqual(f.w);
      expect(f.footY).toBeLessThanOrEqual(f.h);
    }
});
it("combat overrides walking, actual distress selects distress art, reduced motion freezes frames", () => {
  const w = createWorld(0),
    v = w.villagers[0];
  v.route = [[20, 15]];
  expect(poses.walk).toContain(residentPose(v, w, 0).frame);
  w.disasters = [{ kind: "fight", x: v.x, y: v.y, life: 90, people: [0, 1] }];
  expect(poses.fight).toContain(residentPose(v, w, 0).frame);
  w.settings.reducedMotion = true;
  expect(residentPose(v, w, 0)).toEqual(residentPose(v, w, 19));
  w.disasters = [];
  v.route = [];
  v.health = 10;
  expect(poses.hurt).toContain(residentPose(v, w, 0).frame);
  v.health = 100;
  v.morale = 10;
  expect(poses.tired).toContain(residentPose(v, w, 0).frame);
});
