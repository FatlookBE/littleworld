import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import { restore } from "./persistence";
import {
  cancelVisit,
  doorBusy,
  doorOpening,
  doorStep,
  indoors,
  tryHomeVisit,
  updateHomeVisit,
} from "./home-visits";
import { apocalypse } from "./apocalypse";
function scene() {
  const w = createWorld(1);
  w.tick = 100;
  const v = w.villagers[0],
    b = w.buildings[v.home];
  for (const other of w.villagers) {
    other.x = 27;
    other.y = 27;
    other.target = [27, 27];
  }
  [v.x, v.y] = doorStep(b);
  v.target = [v.x, v.y];
  v.route = [];
  v.action = "Se repose à la maison";
  return { w, v, b };
}
it("opens, passes, closes, rests inside, then opens and exits without leaving the island", () => {
  const { w, v, b } = scene();
  expect(tryHomeVisit(w, v)).toBe(true);
  for (let i = 0; i < 100 && v.visit?.phase !== "inside"; i++) {
    w.tick++;
    updateHomeVisit(w, v);
  }
  expect(indoors(v)).toBe(true);
  expect(v.route).toHaveLength(0);
  const until = v.visit!.until;
  w.tick = until;
  updateHomeVisit(w, v);
  expect(v.visit?.phase).toBe("exiting");
  const saved = restore(JSON.stringify(w));
  expect(saved.villagers[0].visit?.phase).toBe("exiting");
  w.tick += 9;
  updateHomeVisit(w, v);
  expect(v.visit).toBeUndefined();
  expect([v.x, v.y]).toEqual(doorStep(b));
  expect(v.visitAfter).toBeGreaterThan(w.tick);
});
it("serializes doorway traffic without closing on the next resident", () => {
  const { w, v, b } = scene();
  const other = w.villagers[1];
  expect(tryHomeVisit(w, v)).toBe(true);
  [other.x, other.y] = doorStep(b);
  other.target = [other.x, other.y];
  other.route = [];
  other.action = "Se repose à la maison";
  expect(doorBusy(w, b.id, other.id)).toBe(true);
  expect(tryHomeVisit(w, other)).toBe(false);
  v.visit = {
    building: b.id,
    phase: "inside",
    since: w.tick,
    until: w.tick + 50,
  };
  expect(tryHomeVisit(w, other)).toBe(true);
  w.tick = v.visit.until;
  updateHomeVisit(w, v);
  expect(v.visit.phase).toBe("inside");
});
it("evacuates an endangered home and rejects visits into ruins or a fire", () => {
  const { w, v, b } = scene();
  v.visit = {
    building: b.id,
    phase: "inside",
    since: w.tick,
    until: w.tick + 50,
  };
  w.disasters = [{ kind: "fire", x: b.x, y: b.y, life: 100, people: [] }];
  updateHomeVisit(w, v);
  expect(v.visit.phase).toBe("exiting");
  cancelVisit(w, v);
  v.visitAfter = 0;
  v.action = "Se repose à la maison";
  expect(tryHomeVisit(w, v)).toBe(false);
  w.disasters = [];
  b.condition = 10;
  expect(tryHomeVisit(w, v)).toBe(false);
});
it("does not let creatures target an indoor resident", () => {
  const { w, v, b } = scene();
  for (const other of w.villagers) if (other !== v) other.dead = true;
  v.visit = {
    building: b.id,
    phase: "inside",
    since: w.tick,
    until: w.tick + 50,
  };
  w.disasters = [
    {
      kind: "monster",
      x: v.x,
      y: v.y,
      life: 100,
      people: [v.id],
      attackAt: w.tick - 4,
    },
  ];
  const health = v.health;
  apocalypse(
    w,
    () => 0.9,
    () => {},
  );
  expect(v.health).toBe(health);
});
it("keeps door movement bounded, validates saved visits and old saves", () => {
  expect([-1, 0, 1.5, 3, 5, 7.5, 9, 10].map(doorOpening)).toEqual([
    0, 0, 0.5, 1, 1, 0.5, 0, 0,
  ]);
  const { w, v, b } = scene();
  expect(restore(JSON.stringify(w)).villagers[0].visit).toBeUndefined();
  v.visit = {
    building: b.id,
    phase: "inside",
    since: w.tick,
    until: w.tick + 60,
  };
  expect(restore(JSON.stringify(w)).villagers[0].visit).toEqual(v.visit);
  v.visit.building = 14;
  expect(() => restore(JSON.stringify(w))).toThrow("Habitants");
});
it("clears indoor state on death and keeps remains outside the doorway", () => {
  const { w, v, b } = scene();
  v.visit = {
    building: b.id,
    phase: "inside",
    since: w.tick,
    until: w.tick + 60,
  };
  v.health = 0;
  step(w);
  expect(v.dead).toBe(true);
  expect(v.visit).toBeUndefined();
  expect([v.x, v.y]).toEqual(doorStep(b));
});

it("schedules recurring house visits through the normal simulation", () => {
  const w = createWorld(1);
  const entered = new Set<number>(),
    exited = new Set<number>();
  for (let tick = 0; tick < 2400; tick++) {
    step(w);
    for (const v of w.villagers) {
      if (indoors(v)) entered.add(v.id);
      if (v.visit?.phase === "exiting") exited.add(v.id);
    }
  }
  expect(entered.size).toBe(24);
  expect(exited.size).toBe(24);
});
it("rejects concurrent saved passages through one door", () => {
  const { w, v, b } = scene();
  v.visit = {
    building: b.id,
    phase: "entering",
    since: w.tick,
    until: w.tick + 20,
  };
  w.villagers[1].visit = { ...v.visit };
  expect(() => restore(JSON.stringify(w))).toThrow("Passages de porte");
});
