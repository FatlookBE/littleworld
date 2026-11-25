import { expect, it, vi } from "vitest";
import { createWorld } from "./core/engine";
import { reconstructionJob } from "./core/reconstruction";
import { drawRepairSite, repairSites } from "./repair-scene";

function repair() {
  const w = createWorld(0);
  const [worker] = w.villagers;
  const building = w.buildings[8];
  building.condition = 35;
  const job = reconstructionJob(w, worker)!;
  worker.repairTarget = job.b.id;
  worker.action = `Reconstruit ${job.b.name}`;
  [worker.x, worker.y] = worker.target = job.target;
  worker.route = [];
  return { w, worker, building };
}

it("adds props only at a work stop, never while the villager travels or a fire intervenes", () => {
  const { w, worker, building } = repair();
  worker.route = [worker.target];
  expect(repairSites(w)).toEqual([]);
  worker.route = [];
  expect(repairSites(w)).toEqual([{
    building: building.id, x: worker.x, y: worker.y, stage: "structure",
  }]);
  w.disasters = [{ kind: "fire", x: building.x, y: building.y, life: 20, people: [] }];
  expect(repairSites(w)).toEqual([]);
});

it("changes props as the repair progresses and hides them once work is complete", () => {
  const { w, building } = repair();
  expect(repairSites(w)[0].stage).toBe("structure");
  building.condition = 71;
  expect(repairSites(w)[0].stage).toBe("finishing");
  building.condition = 85;
  expect(repairSites(w)).toEqual([]);
});

it("draws the stage-specific props and restores the canvas state", () => {
  const { w, building } = repair();
  const c = {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
    beginPath: vi.fn(), ellipse: vi.fn(), fill: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(),
  };
  const ctx = c as unknown as CanvasRenderingContext2D;
  drawRepairSite(ctx, repairSites(w)[0], [30, 40], 1);
  expect(c.fillRect).toHaveBeenCalledWith(-25, -14, 16, 3);
  expect(c.fillRect).not.toHaveBeenCalledWith(-7, -6, 5, 6);
  building.condition = 75;
  c.fillRect.mockClear();
  drawRepairSite(ctx, repairSites(w)[0], [30, 40], 1);
  expect(c.fillRect).toHaveBeenCalledWith(-7, -6, 5, 6);
  expect(c.fillRect).not.toHaveBeenCalledWith(-25, -14, 16, 3);
  expect(c.restore).toHaveBeenCalledTimes(2);
});
