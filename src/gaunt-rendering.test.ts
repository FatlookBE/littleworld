import { afterEach, expect, it, vi } from "vitest";
import { ResidentAtlas } from "./sprites";
import { createWorld } from "./core/engine";

afterEach(() => vi.unstubAllGlobals());
function setup() {
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      onload = null;
      onerror = null;
    },
  );
  const atlas = new ResidentAtlas();
  const targets = [
    atlas.gauntWalk,
    atlas.gauntFightCycle,
    atlas.fightCycle,
    atlas.gauntReactions,
    ...Object.values(atlas.gauntActivities),
    atlas.reactions,
    ...Object.values(atlas.activities),
  ];
  for (const target of targets) {
    target.ready = true;
    target.draw = vi.fn(() => true);
  }
  const w = createWorld(0),
    v = w.villagers[0];
  v.malnutrition = 80;
  v.health = 80;
  v.morale = 80;
  v.route = [];
  v.target = [v.x, v.y];
  const ctx = {
    save() {},
    restore() {},
    filter: "none",
  } as CanvasRenderingContext2D;
  return { atlas, w, v, ctx };
}
it("keeps gaunt appearance during meals, combat and hits", () => {
  const { atlas, w, v, ctx } = setup();
  v.action = "Prend un repas avec ses provisions";
  atlas.draw(ctx, v, w, 0, 0, 0, 1);
  expect(atlas.gauntActivities.eat.draw).toHaveBeenCalledOnce();
  expect(atlas.activities.eat.draw).not.toHaveBeenCalled();
  w.disasters = [{ kind: "fight", x: v.x, y: v.y, life: 90, people: [v.id] }];
  atlas.draw(ctx, v, w, 0, 0, 0, 1);
  expect(atlas.gauntFightCycle.draw).toHaveBeenCalledOnce();
  expect(atlas.fightCycle.draw).not.toHaveBeenCalled();
  v.hitAt = w.tick;
  atlas.draw(ctx, v, w, 0, 0, 0, 1);
  expect(atlas.gauntReactions.draw).toHaveBeenCalledOnce();
  expect(atlas.reactions.draw).not.toHaveBeenCalled();
});
it("freezes gaunt combat poses when reduced motion is enabled", () => {
  const { atlas, w, v, ctx } = setup();
  w.settings.reducedMotion = true;
  w.disasters = [{ kind: "fight", x: v.x, y: v.y, life: 90, people: [v.id] }];
  atlas.draw(ctx, v, w, 0, 0, 0, 1);
  atlas.draw(ctx, v, w, 12, 0, 0, 1);
  const calls = vi.mocked(atlas.gauntFightCycle.draw).mock.calls;
  expect(calls[0][1]).toBe(calls[1][1]);
});

it("starts kneading and care at pose zero after arrival, retaining gaunt appearance", () => {
  const { atlas, w, v, ctx } = setup();
  v.actionAt = 200;
  v.action = "Pétrit le pain";
  atlas.draw(ctx, v, w, 40, 0, 0, 1);
  const start = vi.mocked(atlas.gauntActivities.bake.draw).mock.calls[0];
  expect(start[1] % 6).toBe(0);
  atlas.draw(ctx, v, w, 40.45, 0, 0, 1);
  const next = vi.mocked(atlas.gauntActivities.bake.draw).mock.calls[1];
  expect(next[1] % 6).toBe(2);
  v.action = "Soigne ses voisins";
  atlas.draw(ctx, v, w, 40, 0, 0, 1);
  expect(atlas.gauntActivities.care.draw).toHaveBeenCalledOnce();
  expect(atlas.activities.care.draw).not.toHaveBeenCalled();
});
it("uses the carrying walk while travelling and stops its leg cycle at destination", () => {
  const { atlas, w, v, ctx } = setup();
  v.action = "Porte de l’eau à ses voisins";
  v.actionAt = 0;
  v.route = [[v.x + 1, v.y]];
  atlas.draw(ctx, v, w, 0.5, 0, 0, 1);
  const moving = vi.mocked(atlas.gauntActivities.carry.draw).mock.calls[0];
  expect(moving[1] % 6).toBe(3);
  v.route = [];
  v.target = [v.x, v.y];
  atlas.draw(ctx, v, w, 0.5, 0, 0, 1);
  const stopped = vi.mocked(atlas.gauntActivities.carry.draw).mock.calls[1];
  expect(stopped[1] % 6).toBe(0);
});
