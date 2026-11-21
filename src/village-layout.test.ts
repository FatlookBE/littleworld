import { expect, it } from "vitest";
import { createWorld } from "./core/engine";
import { walkable } from "./core/navigation";
import { field, onLane } from "./village-layout";

it("keeps the lanes and crops clear of occupied building tiles", () => {
  const w = createWorld(0);
  w.water = 0;
  for (let y = 0; y < 29; y++) {
    for (let x = 0; x < 29; x++) {
      const inField =
        x >= field.x &&
        x < field.x + field.width &&
        y >= field.y &&
        y < field.y + field.height;
      const road = onLane(x + 0.5, y + 0.5);
      if (road || inField)
        expect(walkable(w, x, y), `tile ${x},${y}`).toBe(true);
      if (inField) expect(road).toBe(false);
    }
  }
});

it("selects the projected field across all rows and gives residents priority", async () => {
  const { WorldRenderer } = await import("./world");
  const renderer = Object.assign(Object.create(WorldRenderer.prototype), {
    width: 900,
    height: 700,
    scale: 0.7,
    pan: [24, -18],
    shake: [1, 2],
    hits: [],
  });
  const [x, y] = renderer.project(
    field.x + field.width / 2,
    field.y + field.height / 2,
  );
  renderer.farmHit = { kind: "building", id: 9, x, y };
  for (const dx of [0.1, field.width - 0.1]) {
    for (const dy of [0.1, field.height - 0.1]) {
      expect(
        renderer.hit(...renderer.project(field.x + dx, field.y + dy)),
      ).toBe(renderer.farmHit);
    }
  }
  expect(
    renderer.hit(...renderer.project(field.x - 0.1, field.y + 1)),
  ).toBeUndefined();
  const resident = { kind: "person", id: 1, x, y };
  renderer.hits.push(resident);
  expect(renderer.hit(x, y)).toBe(resident);
});
