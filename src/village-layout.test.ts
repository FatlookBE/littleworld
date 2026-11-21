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
