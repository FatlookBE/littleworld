import { expect, it, vi } from "vitest";
import { createWorld } from "./core/engine";
import { bridgeRows, riverCenter } from "./core/navigation";
import { drawStoryCue, storyCue, storyTraces } from "./story-scene";

it("shows no clue before an arc or after it has finished", () => {
  const w = createWorld(0);
  expect(storyCue(w)).toBeNull();
  w.stories = { finished: ["lanterns"], nextAt: 1000 };
  expect(storyCue(w)).toBeNull();
});

it("locates the clues in the world, not at a moving character", () => {
  const w = createWorld(0);
  w.stories = {
    nextAt: 0,
    finished: [],
    active: { id: "cistern", phase: 1, due: 300, person: 0 },
  };
  const y = bridgeRows[1] + 0.5;
  expect(storyCue(w)).toEqual({
    id: "cistern",
    phase: 1,
    x: riverCenter(y),
    y,
    label: "Au pont",
  });
  w.stories.active!.id = "seed-cache";
  const hall = w.buildings.find((b) => b.type === "market")!;
  expect(storyCue(w)).toMatchObject({
    x: hall.x + 1,
    y: hall.y + 2.1,
    label: "À la Halle",
  });
});

it("draws a second lantern only when the next clue is revealed and restores canvas state", () => {
  const w = createWorld(0);
  w.stories = {
    nextAt: 0,
    finished: [],
    active: { id: "lanterns", phase: 0, due: 300, person: 0 },
  };
  const c = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
  };
  const ctx = c as unknown as CanvasRenderingContext2D;
  drawStoryCue(ctx, storyCue(w)!, [30, 40], 1);
  expect(c.strokeRect).toHaveBeenCalledTimes(1);
  c.strokeRect.mockClear();
  w.stories.active!.phase = 1;
  drawStoryCue(ctx, storyCue(w)!, [30, 40], 1);
  expect(c.strokeRect).toHaveBeenCalledTimes(2);
  expect(c.save).toHaveBeenCalledTimes(2);
  expect(c.restore).toHaveBeenCalledTimes(2);
});

it("locates the starter at the bakery and only draws the dough after the clue", () => {
  const w = createWorld(0);
  const bakery = w.buildings.find((building) => building.type === "bakery")!;
  w.stories = {
    nextAt: 0, finished: [],
    active: { id: "lost-starter", phase: 0, due: 300, person: 0 },
  };
  expect(storyCue(w)).toMatchObject({
    label: "À la boulangerie", x: bakery.x + 0.65, y: bakery.y + 2.1,
  });
  const c = {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(),
    ellipse: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
  };
  const ctx = c as unknown as CanvasRenderingContext2D;
  drawStoryCue(ctx, storyCue(w)!, [30, 40], 1);
  expect(c.ellipse).not.toHaveBeenCalled();
  w.stories.active!.phase = 1;
  drawStoryCue(ctx, storyCue(w)!, [30, 40], 1);
  expect(c.ellipse).toHaveBeenCalledTimes(2);
});

it("leaves independent bridge traces without making a completed story active", () => {
  const w = createWorld(0);
  expect(storyTraces(w)).toEqual([]);
  w.stories = {
    nextAt: 90,
    finished: ["cistern", "lanterns"],
    traces: ["cistern", "lanterns"],
  };
  const [cistern, lanterns] = storyTraces(w);
  expect(cistern.id).toBe("cistern");
  expect(lanterns.id).toBe("lanterns");
  expect(cistern.x - lanterns.x).toBeCloseTo(2.4);
  expect(storyCue(w)).toBeNull();
});
