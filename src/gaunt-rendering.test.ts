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
  expect(atlas.gauntReactions.draw).toHaveBeenCalledOnce();
  v.hitAt = w.tick;
  atlas.draw(ctx, v, w, 0, 0, 0, 1);
  expect(atlas.gauntReactions.draw).toHaveBeenCalledTimes(2);
  expect(atlas.reactions.draw).not.toHaveBeenCalled();
});
it("freezes gaunt combat poses when reduced motion is enabled", () => {
  const { atlas, w, v, ctx } = setup();
  w.settings.reducedMotion = true;
  w.disasters = [{ kind: "fight", x: v.x, y: v.y, life: 90, people: [v.id] }];
  atlas.draw(ctx, v, w, 0, 0, 0, 1);
  atlas.draw(ctx, v, w, 12, 0, 0, 1);
  const calls = vi.mocked(atlas.gauntReactions.draw).mock.calls;
  expect(calls[0][1]).toBe(calls[1][1]);
});
