import type { Memory, Villager, World } from "./types";

type StoryId = "cistern" | "seed-cache" | "lanterns";
type StoryState = {
  active?: { id: StoryId; phase: 0 | 1; due: number; person: number };
  nextAt: number;
  finished: StoryId[];
};
type StoryNote = (text: string, kind: Memory["kind"], person: number) => void;
type Outcome = {
  kind: Memory["kind"];
  text: string;
  water?: number;
  food?: number;
  cooperation?: number;
};

const ids: readonly StoryId[] = ["cistern", "seed-cache", "lanterns"];
const probeEvery = 24;
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const stories: Record<
  StoryId,
  {
    when: (w: World) => boolean;
    lead: (v: Villager) => string;
    turn: (v: Villager) => string;
    end: (w: World, v: Villager) => Outcome;
  }
> = {
  cistern: {
    when: (w) => w.pressure >= 30 && w.water < 62,
    lead: (v) =>
      `${v.name} suit la file du puits et remarque de l’eau sous la grille du pont.`,
    turn: (v) =>
      `${v.name} déchiffre les marques de la grille : c’est l’entrée d’une ancienne citerne, pas un égout.`,
    end: (w, v) =>
      w.cooperation >= 43
        ? {
            kind: "hope",
            text: `${v.name} et ses voisins dégagent la vanne. Les foyers se partagent les premières jarres de la citerne.`,
            water: 10,
            cooperation: 4,
          }
        : {
            kind: "warning",
            text: `${v.name} retrouve la grille refermée. Faute d’accord entre les foyers, la citerne reste scellée.`,
            cooperation: -2,
          },
  },
  "seed-cache": {
    when: (w) => w.pressure >= 38 && w.food < 58,
    lead: (v) =>
      `${v.name} trouve des enveloppes de graines dans une jarre murée de la Halle.`,
    turn: (v) =>
      `${v.name} lit les dates sur les enveloppes : plusieurs graines pourraient encore germer.`,
    end: (w, v) =>
      w.water >= 25 && w.cooperation >= 35
        ? {
            kind: "hope",
            text: `${v.name} partage les semences et les voisins mettent une partie de leurs réserves en commun jusqu’aux prochaines pousses.`,
            food: 6,
            cooperation: 3,
          }
        : {
            kind: "ordinary",
            text: `${v.name} confie les graines à deux foyers : mieux vaut les garder au sec que les semer maintenant.`,
          },
  },
  lanterns: {
    when: (w) =>
      w.tick >= 240 && w.cooperation >= 60 && w.food >= 45 && w.water >= 45,
    lead: (v) =>
      `${v.name} accroche une lanterne au pont. Une seconde s’allume à la fenêtre d’en face.`,
    turn: (v) =>
      `${v.name} découvre le code des lumières : une pour demander un coup de main, deux pour l’offrir.`,
    end: (w, v) =>
      w.cooperation >= 55
        ? {
            kind: "hope",
            text: `${v.name} traverse le pont avec des voisins. Les lanternes ont réuni assez de monde pour organiser des tournées d’entraide.`,
            cooperation: 5,
          }
        : {
            kind: "ordinary",
            text: `${v.name} décroche la dernière lanterne. Les foyers gardent le code pour des jours meilleurs.`,
          },
  },
};

export function validVillageStories(
  value: unknown,
  tick: number,
  people: number,
) {
  if (!value || typeof value !== "object") return false;
  const s = value as StoryState;
  const scheduled = (n: unknown): n is number =>
    typeof n === "number" &&
    Number.isSafeInteger(n) &&
    n >= 0 &&
    n <= tick + 3000;
  return (
    scheduled(s.nextAt) &&
    Array.isArray(s.finished) &&
    s.finished.length <= ids.length &&
    new Set(s.finished).size === s.finished.length &&
    s.finished.every((id) => ids.includes(id)) &&
    (s.active === undefined ||
      (s.active !== null &&
        ids.includes(s.active.id) &&
        !s.finished.includes(s.active.id) &&
        (s.active.phase === 0 || s.active.phase === 1) &&
        scheduled(s.active.due) &&
        Number.isInteger(s.active.person) &&
        s.active.person >= 0 &&
        s.active.person < people))
  );
}

export function advanceVillageStories(w: World, note: StoryNote) {
  if (!w.stories && (w.tick < 240 || w.tick % probeEvery !== 0)) return;
  const state: StoryState = (w.stories ??= { nextAt: w.tick, finished: [] });
  const delay = (ticks: number) =>
    Math.ceil(ticks / Math.max(0.25, w.settings.eventFrequency));
  const active = state.active;
  if (active) {
    if (w.tick < active.due) return;
    const original = w.villagers[active.person];
    const person =
      original && !original.dead && original.age >= 16
        ? original
        : w.villagers.find((v) => !v.dead && v.age >= 16);
    const story = stories[active.id];
    if (active.phase === 0 && person) {
      note(story.turn(person), "ordinary", person.id);
      active.person = person.id;
      active.phase = 1;
      active.due = w.tick + delay(58);
      return;
    }
    if (person) {
      const outcome = story.end(w, person);
      if (outcome.water) w.water = clamp(w.water + outcome.water);
      if (outcome.food) w.food = clamp(w.food + outcome.food);
      if (outcome.cooperation)
        w.cooperation = clamp(w.cooperation + outcome.cooperation);
      note(outcome.text, outcome.kind, person.id);
    }
    state.finished.push(active.id);
    delete state.active;
    state.nextAt = w.tick + delay(120);
    return;
  }

  if (state.finished.length === ids.length || w.tick < state.nextAt) return;
  state.nextAt = w.tick + probeEvery;
  const id = ids.find(
    (candidate) =>
      !state.finished.includes(candidate) && stories[candidate].when(w),
  );
  if (!id) return;
  const adults = w.villagers.filter((v) => !v.dead && v.age >= 16);
  // Do not advance the shared RNG: stories should not perturb existing disasters.
  if (!adults.length) return;
  const person = adults[(w.seed + w.tick) % adults.length];
  state.active = { id, phase: 0, due: w.tick + delay(42), person: person.id };
  note(stories[id].lead(person), "ordinary", person.id);
}

export type { StoryState };
