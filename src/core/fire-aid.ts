import type { Building, World } from "./types";

const waterCost = 5;
const minimumRemaining = 4;
export const maxFireAidTicks = 90;

export function fireAid(w: World, b: Building) {
  const fire = w.disasters?.find(
    (e) =>
      e.kind === "fire" && e.life >= 2 && Math.hypot(e.x - b.x, e.y - b.y) < 1,
  );
  if (!fire) return null;
  return {
    fire,
    waterCost,
    unavailable: fire.waterAidTicks
      ? "Un renfort a déjà été envoyé pour cet incendie."
      : w.water < waterCost + minimumRemaining
        ? `Il faut ${waterCost + minimumRemaining} points d’eau pour garder une réserve après l’envoi.`
        : null,
  };
}

export function sendFireWater(w: World, siteId: number) {
  const site = w.buildings.find((b) => b.id === siteId);
  const option = site && fireAid(w, site);
  if (!site || !option || option.unavailable) return null;
  w.water -= option.waterCost;
  const fire = option.fire;
  const removed = Math.min(
    maxFireAidTicks,
    Math.ceil(fire.life * 0.45),
    Math.floor(fire.life - 1),
  );
  fire.life -= removed;
  fire.waterAidTicks = removed;
  return site;
}
