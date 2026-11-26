import { expect, it } from "vitest";
import { AidFeedbacks, aidPose } from "./aid-feedback";
import { createWorld } from "./core/engine";
import { extraResidentPose } from "./extra-residents";

it("keeps marker feedback local to the current world and expires while the simulation is paused", () => {
  const w = createWorld(0);
  const feedback = new AidFeedbacks();
  feedback.show(w, 1, "water", 200);
  feedback.show(w, 2, "food", 400);
  feedback.update(w, 600);
  expect(feedback.forResident(1, 600)).toEqual({
    supply: "water",
    elapsed: 400,
  });
  expect(feedback.forResident(2, 600)).toEqual({
    supply: "food",
    elapsed: 200,
  });
  feedback.update(w, 2400);
  expect(feedback.forResident(1, 2400)).toBeUndefined();
  expect(feedback.forResident(2, 2400)).toBeDefined();
  feedback.update(createWorld(0), 2410);
  expect(feedback.forResident(2, 2410)).toBeUndefined();
  expect(w.tick).toBe(0);
});

it("reuses the drink and meal poses only for a stationary, uninjured resident", () => {
  const w = createWorld(0);
  const v = w.villagers[1];
  v.target = [v.x, v.y];
  v.route = [];
  const before = structuredClone(v);
  const water = { supply: "water", elapsed: 400 } as const;
  const meal = { supply: "food", elapsed: 400 } as const;
  expect(aidPose(v, w, water)?.activity).toBe("drink");
  expect(extraResidentPose(v, w, 0, water).frame).toBe(25);
  expect(extraResidentPose(v, w, 0, meal).frame).toBe(29);
  expect(aidPose(v, w, { ...water, elapsed: 1200 })).toBeUndefined();
  expect(v).toEqual(before);
  v.route = [[v.x + 1, v.y]];
  expect(aidPose(v, w, water)).toBeUndefined();
  v.route = [];
  v.hitAt = w.tick;
  expect(aidPose(v, w, water)).toBeUndefined();
});
