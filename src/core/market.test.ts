import { expect, it } from "vitest";
import { TICKS_PER_DAY } from "../daylight";
import { createWorld, newSession, tradeAtMarket } from "./engine";
import { marketOffer, swapMarketGoods } from "./market";
import { restore } from "./persistence";
import { DAYS_PER_SEASON } from "./seasons";

function village(tick = 30) {
  const w = createWorld(0);
  w.tick = tick;
  w.food = 45;
  w.water = 42;
  const hall = w.buildings.find((b) => b.type === "market")!;
  return { w, hall };
}

it("opens exactly from 10:00 to 16:00 each village day", () => {
  const { w, hall } = village();
  expect(marketOffer(w, w.buildings[0])).toBeNull();
  for (const [tick, open] of [
    [23, false],
    [24, true],
    [95, true],
    [96, false],
    [312, true],
  ] as const) {
    w.tick = tick;
    expect(marketOffer(w, hall)?.open).toBe(open);
  }
});

it("turns water into food in autumn and food into water in summer", () => {
  const year = TICKS_PER_DAY * DAYS_PER_SEASON;
  const autumn = village(2 * year + 30);
  const summer = village(year + 30);
  expect(swapMarketGoods(autumn.w, autumn.hall.id)?.offer).toMatchObject({
    gives: "water",
    gets: "food",
    cost: 7,
    amount: 6,
  });
  expect([autumn.w.water, autumn.w.food]).toEqual([35, 51]);
  expect(swapMarketGoods(summer.w, summer.hall.id)?.offer).toMatchObject({
    gives: "food",
    gets: "water",
    cost: 7,
    amount: 5,
  });
  expect([summer.w.water, summer.w.food]).toEqual([47, 38]);
});

it("closes during danger, if the hall is too damaged, or if no adult is alive", () => {
  const { w, hall } = village();
  w.disasters = [{ kind: "fire", x: hall.x, y: hall.y, life: 3, people: [] }];
  expect(swapMarketGoods(w, hall.id)).toBeNull();
  w.disasters[0].life = 0;
  hall.condition = 44;
  expect(marketOffer(w, hall)?.open).toBe(false);
  hall.condition = 45;
  w.weather = "Vent de poussière";
  expect(marketOffer(w, hall)?.open).toBe(false);
  w.weather = "Ciel clair";
  for (const v of w.villagers) v.age = 8;
  expect(marketOffer(w, hall)?.open).toBe(false);
  expect(w.marketTradedAt).toBeUndefined();
});

it("never accepts an exchange that would deplete or overflow stores", () => {
  const { w, hall } = village();
  w.water = 18.9;
  expect(swapMarketGoods(w, hall.id)).toBeNull();
  w.water = 19;
  w.food = 95.1;
  expect(swapMarketGoods(w, hall.id)).toBeNull();
  expect(w.marketTradedAt).toBeUndefined();
  w.food = 95;
  expect(swapMarketGoods(w, hall.id)).not.toBeNull();
  expect([w.water, w.food]).toEqual([12, 100]);
});

it("records the trade at the hall and in the chronicle, once per day across reloads", () => {
  const { w, hall } = village();
  expect(restore(JSON.stringify(w)).marketTradedAt).toBeUndefined();
  expect(tradeAtMarket(w, hall.id)).toBe(
    "Troc à la Halle : 7 points d’eau contre 5 points de nourriture.",
  );
  const loaded = restore(JSON.stringify(w));
  expect(loaded.buildings[hall.id].events[0]).toEqual(loaded.chronicle[0]);
  expect(tradeAtMarket(loaded, hall.id)).toBeNull();
  loaded.tick += TICKS_PER_DAY;
  expect(tradeAtMarket(loaded, hall.id)).not.toBeNull();
  loaded.settings.scenario = "session";
  newSession(loaded, 1);
  expect(loaded.marketTradedAt).toBeUndefined();
  expect(restore(JSON.stringify(loaded)).tick).toBe(0);
});

it("rejects invalid timestamps when restoring a save", () => {
  const { w } = village();
  for (const marketTradedAt of [-1, 25.5, w.tick + 1, null, "0"]) {
    expect(() => restore(JSON.stringify({ ...w, marketTradedAt }))).toThrow(
      "Structure de sauvegarde invalide.",
    );
  }
});
