import type { Building, Villager, World } from "./types";

export function homeIsUnsafe(w: World, b: Building) {
  return (
    b.condition <= 15 ||
    Boolean(
      w.disasters?.some(
        (event) =>
          event.kind === "fire" &&
          event.life > 0 &&
          Math.hypot(event.x - b.x, event.y - b.y) < 3,
      ),
    )
  );
}

export const needsHomeCare = (v: Villager) =>
  v.bornAt !== undefined && v.age < 3;

export function indoors(v: Villager, w: World) {
  return (
    !v.dead &&
    (v.visit?.phase === "inside" ||
      (needsHomeCare(v) && !homeIsUnsafe(w, w.buildings[v.home])))
  );
}
