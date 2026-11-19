import { expect, it } from "vitest";
import { createWorld, step } from "./engine";
import { restore } from "./persistence";
import { reconstructionJob, repairAtDestination } from "./reconstruction";
import {
  ensureLocalEnvironment,
  updateLocalEnvironment,
} from "./local-environment";
import { updateNutrition } from "./nutrition";

it("sends residents to damaged buildings and records a completed repair stage", () => {
  const w = createWorld(0);
  const b = w.buildings[0];
  b.condition = 5;
  let sawRepair = false;
  for (let i = 0; i < 750 && b.condition <= 15; i++) {
    step(w);
    sawRepair ||= w.villagers.some((v) => v.repairTarget === b.id);
  }
  expect(sawRepair).toBe(true);
  expect(b.condition).toBeGreaterThan(15);
  expect(b.events.some((e) => e.text.includes("reconstruction"))).toBe(true);
  expect(restore(JSON.stringify(w)).buildings[b.id].condition).toBe(
    b.condition,
  );
});

it("reserves a repair for one resident and halts it during a fire", () => {
  const w = createWorld(0),
    [worker, neighbour] = w.villagers;
  const b = w.buildings[8];
  b.condition = 35;
  const job = reconstructionJob(w, worker)!;
  expect(job.b).toBe(b);
  worker.repairTarget = b.id;
  worker.action = `Reconstruit ${b.name}`;
  worker.target = job.target;
  [worker.x, worker.y] = job.target;
  worker.route = [];
  expect(reconstructionJob(w, neighbour)).toBeUndefined();
  w.disasters = [{ kind: "fire", x: b.x, y: b.y, life: 200, people: [] }];
  repairAtDestination(w, worker);
  expect(b.condition).toBe(35);
  w.disasters = [];
  repairAtDestination(w, worker);
  expect(b.condition).toBeGreaterThan(35);
});

it("lets drier outlying soil and underfed residents recover over time", () => {
  const w = createWorld(0);
  const soil = ensureLocalEnvironment(w).plots[35];
  w.water = w.moisture = 100;
  soil.health = 65;
  soil.scorch = 10;
  for (let i = 0; i < 600; i++) updateLocalEnvironment(w);
  expect(soil.health).toBeGreaterThan(70);
  expect(soil.scorch).toBeLessThan(10);
  const v = w.villagers[0];
  v.malnutrition = 65;
  v.hunger = 10;
  for (let i = 0; i < 300; i++) updateNutrition(v);
  expect(v.malnutrition).toBeCloseTo(47);
});

it("interrupts a reconstruction trip when fire breaks out and rejects work during combat", () => {
  const w = createWorld(0),
    [worker, neighbour] = w.villagers;
  const site = w.buildings[8];
  site.condition = 35;
  worker.repairTarget = site.id;
  worker.action = `Reconstruit ${site.name}`;
  worker.target = [site.x + 0.5, site.y + 2.5];
  worker.route = [worker.target];
  w.disasters = [{ kind: "fire", x: site.x, y: site.y, life: 200, people: [] }];
  step(w);
  expect(worker.repairTarget).toBeUndefined();
  expect(worker.action.startsWith("Reconstruit")).toBe(false);
  worker.repairTarget = site.id;
  worker.action = `Reconstruit ${site.name}`;
  [worker.x, worker.y] = worker.target = [site.x + 0.5, site.y + 2.5];
  worker.route = [];
  w.disasters = [
    {
      kind: "fight",
      x: worker.x,
      y: worker.y,
      life: 40,
      people: [worker.id, neighbour.id],
    },
  ];
  const condition = site.condition;
  repairAtDestination(w, worker);
  expect(site.condition).toBe(condition);
  w.disasters = [];
  worker.hitAt = w.tick;
  repairAtDestination(w, worker);
  expect(site.condition).toBe(condition);
});
