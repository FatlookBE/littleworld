/** One village day lasts 288 ticks and starts at 08:00, like the displayed clock. */
export const TICKS_PER_DAY = 288;
export const hourOf = (tick: number) =>
  (((8 + tick / 12) % 24) + 24) % 24;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 1 in full daylight, 0 at night, with gradual dawn (5–8 h) and dusk (18–21 h 30). */
export function daylight(tick: number) {
  const hour = hourOf(tick);
  return Math.min(smooth(5, 8, hour), 1 - smooth(18, 21.5, hour));
}

/** Strongest at sunrise and sunset, zero at noon and midnight. */
export const goldenHour = (tick: number) => {
  const light = daylight(tick);
  return 4 * light * (1 - light);
};
