import { step } from "./engine";
import { DemoAdapter, ingest } from "./telemetry";
import type { World } from "./types";

const usage = new DemoAdapter();

export function advanceDecayDemo(world: World) {
  if (world.tick < 800 && world.tick % 20 === 0)
    ingest(world, usage.event(world, world.settings.budget / 40));
  if (world.tick === 600)
    world.disasters = [
      ...(world.disasters ?? []),
      {
        kind: "monster",
        species: "horned",
        x: 14,
        y: 15,
        life: 1200,
        people: [],
      },
      {
        kind: "monster",
        species: "wolf",
        x: 18,
        y: 15,
        life: 1000,
        people: [],
      },
    ];
  // At 21:00 the spectre survives until dawn and all three can be seen together.
  if (
    world.tick === 732 &&
    !world.disasters?.some((e) => e.species === "wraith")
  )
    (world.disasters ??= []).push({
      kind: "monster",
      species: "wraith",
      x: 12,
      y: 17,
      life: 400,
      people: [],
    });
  step(world);
}
