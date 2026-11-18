import { expect, it } from "vitest";
import { createWorld, residents } from "./engine";
import { advanceDecayDemo } from "./decay-demo";

it("shows monsters among living residents within fifteen seconds at 8×", () => {
  const w = createWorld(0);
  expect(w.pressure).toBe(0);
  while (w.tick <= 600) advanceDecayDemo(w);
  expect(residents(w).length).toBeGreaterThan(0);
  expect(w.pressure).toBeGreaterThan(50);
  const species = w.disasters
    ?.filter((e) => e.kind === "monster")
    .map((e) => e.species);
  expect(species).toEqual(expect.arrayContaining(["wolf", "horned"]));
  expect(w.usage.every((e) => e.provenance === "demo")).toBe(true);
});

it("shows all three species together when the monster preview opens", () => {
  const w = createWorld(0);
  while (w.tick <= 732) advanceDecayDemo(w);
  expect(
    w.disasters
      ?.filter((e) => e.kind === "monster")
      .map((e) => e.species ?? "horned"),
  ).toEqual(expect.arrayContaining(["horned", "wolf", "wraith"]));
});
