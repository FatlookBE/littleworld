import { hourOf, TICKS_PER_DAY } from "../daylight";
import { season } from "./seasons";
import type { Building, World } from "./types";

const minimumReserve = 12;
const cost = 7;
type Supply = "water" | "food";
const names: Record<Supply, string> = {
  water: "d’eau",
  food: "de nourriture",
};

export function marketOffer(w: World, site: Building) {
  if (site.type !== "market") return null;
  const hour = hourOf(w.tick);
  const inHours = hour >= 10 && hour < 16;
  const ready =
    site.condition >= 45 && w.villagers.some((v) => !v.dead && v.age >= 18);
  const unsafe =
    w.weather === "Vent de poussière" ||
    w.disasters?.some(
      (e) =>
        e.life > 0 &&
        (e.kind === "quake" ||
          ((e.kind === "fire" || e.kind === "monster" || e.kind === "fight") &&
            Math.hypot(e.x - site.x, e.y - site.y) < 4)),
    );
  const sold =
    w.marketTradedAt !== undefined &&
    Math.floor(w.marketTradedAt / TICKS_PER_DAY) ===
      Math.floor(w.tick / TICKS_PER_DAY);
  const s = season(w.tick);
  const gives: Supply = s === 1 || s === 3 ? "food" : "water";
  const gets: Supply = gives === "water" ? "food" : "water";
  const amount = s === 2 || s === 3 ? 6 : 5;
  const open = ready && !unsafe && inHours;
  const unavailable = !ready
    ? "L’étal a besoin d’une halle en état et d’au moins un habitant adulte."
    : unsafe
      ? "L’étal ferme le temps que le danger passe."
      : !inHours
        ? "L’étal ouvre chaque jour de 10 h à 16 h, à l’heure du village."
        : sold
          ? "Le troc du jour a déjà eu lieu."
          : w[gives] < cost + minimumReserve
            ? `Il faut conserver au moins ${minimumReserve} points ${names[gives]} après le troc.`
            : w[gets] + amount > 100
              ? `Il manque de la place dans la réserve ${names[gets]}.`
              : null;
  return {
    open,
    sold,
    gives,
    gets,
    cost,
    amount,
    unavailable,
    terms: `${cost} points ${names[gives]} contre ${amount} points ${names[gets]}`,
  };
}

export function swapMarketGoods(w: World, id: number) {
  const site = w.buildings.find((b) => b.id === id);
  const offer = site && marketOffer(w, site);
  if (!site || !offer || offer.unavailable) return null;
  w[offer.gives] -= offer.cost;
  w[offer.gets] += offer.amount;
  w.marketTradedAt = w.tick;
  return { site, offer };
}
