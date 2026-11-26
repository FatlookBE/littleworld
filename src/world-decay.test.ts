import { expect, it } from "vitest";
import { AidFeedbacks } from "./aid-feedback";
import { WorldRenderer } from "./world";
import { createWorld } from "./core/engine";
import { decayOf } from "./foundation";

it("keeps rendered decay identical in pause, across frame rates and on reload", () => {
  const w = createWorld(1);
  w.pressure = 75;
  w.food = 10;
  w.water = 20;
  // Exercise actual render setup without allocating image assets or painting
  // the whole world; the first paint call is the deliberate stopping point.
  const stop = new Error("first paint");
  const makeRenderer = () =>
    Object.assign(Object.create(WorldRenderer.prototype), {
      resize() {},
      width: 1280,
      height: 720,
      zoom: 1,
      decay: 0,
      aidFeedbacks: new AidFeedbacks(),
      waterLevel: { update() {} },
      ctx: {
        clearRect() {
          throw stop;
        },
      },
    }) as WorldRenderer;
  const first = makeRenderer();
  const render = (r: WorldRenderer) => {
    try {
      r.render(w, 20, null);
    } catch (error) {
      if (error !== stop) throw error;
    }
    return r.decay;
  };
  const expected = decayOf(w);
  expect(render(first)).toBe(expected);
  for (let frame = 0; frame < 120; frame++)
    expect(render(first)).toBe(expected);
  expect(render(makeRenderer())).toBe(expected);
});
