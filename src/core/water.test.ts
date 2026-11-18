import { ingest } from "./telemetry";
import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import { riverCenter, riverHalfWidth, walkable } from "./navigation";

it("exposes the riverbed as reserves fall and permits crossing once completely dry", () => {
  const w = createWorld(0);
  w.buildings = [];
  const y = 3;
  const x = Math.floor(riverCenter(y + 0.5));
  w.water = 100;
  expect(walkable(w, x, y)).toBe(false);
  const full = riverHalfWidth(w);
  w.water = 25;
  expect(riverHalfWidth(w)).toBeGreaterThan(0);
  expect(riverHalfWidth(w)).toBeLessThan(full);
  w.water = 0;
  expect(riverHalfWidth(w)).toBe(0);
  expect(walkable(w, x, y)).toBe(true);
  w.water = 100;
  expect(walkable(w, x, y)).toBe(false);
});

it("sustained collapse exhausts the stream over simulated time", () => {
  const w = createWorld(0);
  for (let tick = 0; tick < 4500; tick++) {
    if (tick % 20 === 0)
      ingest(w, {
        id: `drought-${tick}`,
        session: "drought",
        at: new Date(tick * 200).toISOString(),
        origin: "test",
        provenance: "measured",
        input: 10000,
        output: 10000,
      });
    step(w);
  }
  expect(w.water).toBe(0);
  expect(riverHalfWidth(w)).toBe(0);
});
