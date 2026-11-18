import type { Villager } from "./types";
/** Tick-based stages survive pause, save/load and accelerated simulation. */
export function remainsStage(v: Villager, tick: number) {
  const age = Math.max(0, tick - (v.diedAt ?? tick));
  return age < 5 ? 0 : age < 90 ? 1 : age < 210 ? 2 : 3;
}
export function remainsLabel(v: Villager, tick: number) {
  return remainsStage(v, tick) === 3
    ? "Décédé — squelette au sol"
    : "Décédé — corps au sol";
}
