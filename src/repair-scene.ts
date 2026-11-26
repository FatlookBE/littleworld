import { activeRepairAt } from "./core/reconstruction";
import type { World } from "./core/types";
import { drawPaintedProp } from "./painted-props";

type RepairSite = {
  building: number;
  x: number;
  y: number;
  stage: "structure" | "finishing";
};

/** Match the simulation's actual work, rather than showing props on abandoned sites. */
export function repairSites(w: World): RepairSite[] {
  const sites = new Map<number, RepairSite>();
  for (const v of w.villagers) {
    if (v.repairTarget === undefined) continue;
    const building = activeRepairAt(w, v);
    if (!building || sites.has(building.id)) continue;
    sites.set(building.id, {
      building: building.id,
      x: v.target[0],
      y: v.target[1],
      stage: building.condition <= 70 ? "structure" : "finishing",
    });
  }
  return [...sites.values()];
}

/** Set to one side of the worker so their gesture stays readable. */
export function drawRepairSite(
  c: CanvasRenderingContext2D,
  site: RepairSite,
  screen: [number, number],
  scale: number,
) {
  c.save();
  c.translate(...screen);
  c.scale(scale, scale);
  c.lineWidth = 1;
  c.strokeStyle = "#38281d";
  c.fillStyle = "#251d1855";
  c.beginPath();
  c.ellipse(-12, 1, 11, 3, 0, 0, Math.PI * 2);
  c.fill();

  const structural = site.stage === "structure";
  if (drawPaintedProp(c, "sawhorse", structural ? -15 : -17, 2, structural ? 30 : 20)) {
    if (!structural) drawPaintedProp(c, "bucket", -4, 3, 15);
    c.restore();
    return;
  }

  // Keep the silhouettes readable if the painted atlas is unavailable.
  c.fillStyle = "#855638";
  c.fillRect(-21, -7, 3, 8);
  c.fillRect(-10, -7, 3, 8);
  c.fillStyle = "#c69a65";
  c.fillRect(-23, -11, 17, 4);
  c.strokeRect(-23, -11, 17, 4);
  if (site.stage === "structure") {
    c.fillStyle = "#b87c45";
    c.fillRect(-25, -14, 16, 3);
    c.strokeRect(-25, -14, 16, 3);
    c.fillStyle = "#dec089";
    c.fillRect(-18, -16, 14, 2);
  } else {
    // As the work winds down, a bucket replaces the pile of timber.
    c.fillStyle = "#829291";
    c.fillRect(-7, -6, 5, 6);
    c.strokeRect(-7, -6, 5, 6);
  }
  c.restore();
}
