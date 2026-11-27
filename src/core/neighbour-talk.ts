import { needsHomeCare } from "./shelter";
import type { Memory, Villager, World } from "./types";

const duration = 26;
type Subject = "harvest" | "shortage" | "memories";

export interface NeighbourTalk {
  first: number;
  second: number;
  since: number;
  subject: Subject;
}

function isFree(w: World, v: Villager, mayPauseWalk = false) {
  return (
    !v.dead &&
    !v.visit &&
    !needsHomeCare(v) &&
    (!v.route.length ||
      (mayPauseWalk &&
        /^(Explore les berges|Ramasse du bois|Inspecte les chemins|Cueille des plantes)/.test(
          v.action,
        ))) &&
    v.repairTarget === undefined &&
    v.energy >= 30 &&
    v.hunger < 50 &&
    v.thirst < 45 &&
    v.health >= 30 &&
    v.morale >= 25 &&
    (v.hitAt === undefined || w.tick - v.hitAt >= 4) &&
    !/maison|repose|repas|manger|puits|eau|reconstruit|soigne|soins/i.test(v.action) &&
    !w.disasters?.some(
      (event) =>
        event.life > 0 &&
        ((event.kind === "fight" && event.people.includes(v.id)) ||
          ((event.kind === "fire" || event.kind === "monster") &&
            Math.hypot(event.x - v.x, event.y - v.y) < 4)),
    )
  );
}

function inTalkingRange(first: Villager, second: Villager) {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const distance = Math.hypot(dx, dy);
  // Leave a visible gap in the isometric projection; never stack two sprites.
  return distance >= 0.85 && distance <= 2.8 && Math.abs(dx - dy) >= 0.65;
}

export function talkingPartner(w: World, v: Villager) {
  const talk = w.neighbourTalk;
  if (!talk) return undefined;
  const other =
    talk.first === v.id
      ? w.villagers[talk.second]
      : talk.second === v.id
        ? w.villagers[talk.first]
        : undefined;
  return other && isFree(w, v) && isFree(w, other) && inTalkingRange(v, other)
    ? other
    : undefined;
}

export function advanceNeighbourTalk(
  w: World,
  note: (text: string, kind: Memory["kind"], person: number) => Memory,
) {
  const active = w.neighbourTalk;
  if (active) {
    const first = w.villagers[active.first];
    const second = w.villagers[active.second];
    if (!first || !second || !talkingPartner(w, first)) {
      delete w.neighbourTalk;
      for (const person of [first, second])
        if (person && !person.dead && !person.route.length && !person.visit)
          person.nextDecision = w.tick;
      return;
    }
    if (w.tick - active.since < duration) return;
    delete w.neighbourTalk;
    const text = {
      harvest: "échangent des conseils sur les prochaines récoltes",
      shortage: "parlent de ce qui manque et se remontent le moral",
      memories: "se racontent un souvenir du village",
    }[active.subject];
    const memory = note(
      `${first.name} et ${second.name} ${text}.`,
      "ordinary",
      first.id,
    );
    second.memories.unshift(memory);
    second.memories.length = Math.min(second.memories.length, 24);
    for (const [person, other] of [
      [first, second],
      [second, first],
    ] as const) {
      const tie = person.ties.find((entry) => entry.id === other.id);
      if (tie) tie.bond = Math.min(100, tie.bond + 3);
      person.morale = Math.min(100, person.morale + 2);
      person.cooldown = w.tick + 240;
      person.nextDecision = w.tick + 1;
    }
    return;
  }

  const hour = (w.tick / 12 + 8) % 24;
  const interval = Math.round(12 / w.settings.eventFrequency);
  if (hour < 8 || hour >= 20 || w.tick % interval !== 0) return;
  // Rotate the starting resident so lower IDs don't monopolise the scene.
  const offset = Math.floor(w.tick / interval);
  const count = w.villagers.length;
  for (let i = 0; i < count; i++) {
    const first = w.villagers[(offset + i) % count];
    if (first.cooldown > w.tick || !isFree(w, first, true)) continue;
    for (const tie of first.ties) {
      const second = w.villagers[tie.id];
      if (
        !second ||
        second.id === first.id ||
        tie.bond < 35 ||
        !second.ties.some(
          (reverse) => reverse.id === first.id && reverse.bond >= 35,
        ) ||
        second.cooldown > w.tick ||
        !isFree(w, second, true) ||
        !inTalkingRange(first, second)
      )
        continue;
      for (const person of [first, second]) {
        person.route = [];
        person.target = [person.x, person.y];
      }
      w.neighbourTalk = {
        first: first.id,
        second: second.id,
        since: w.tick,
        subject:
          w.food < 30 || w.water < 35
            ? "shortage"
            : offset % 2
              ? "harvest"
              : "memories",
      };
      return;
    }
  }
}

export function validNeighbourTalk(
  talk: NeighbourTalk,
  tick: number,
  count: number,
) {
  return Boolean(
    talk &&
    [talk.first, talk.second].every(
      (id) => Number.isSafeInteger(id) && id >= 0 && id < count,
    ) &&
    talk.first !== talk.second &&
    Number.isSafeInteger(talk.since) &&
    talk.since >= 0 &&
    talk.since <= tick &&
    tick - talk.since < duration &&
    ["harvest", "shortage", "memories"].includes(talk.subject),
  );
}
