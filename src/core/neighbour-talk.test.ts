import { describe, expect, it } from "vitest";
import { createWorld, newSession, note, step } from "./engine";
import { advanceNeighbourTalk, talkingPartner } from "./neighbour-talk";
import { restore } from "./persistence";

function scene() {
  const w = createWorld(0);
  w.tick = 47;
  for (const v of w.villagers) v.nextDecision = 999;
  const [first, second] = w.villagers;
  for (const [v, x] of [
    [first, 12.5],
    [second, 13.8],
  ] as const)
    Object.assign(v, { x, y: 16.5, target: [x, 16.5], cooldown: 0 });
  for (const v of w.villagers.slice(2)) v.cooldown = 900;
  return {
    w,
    first,
    second,
    update: () =>
      advanceNeighbourTalk(w, (text, kind, person) =>
        note(w, text, kind, person),
      ),
  };
}

describe("conversations between neighbours", () => {
  it("starts autonomously, holds one pair in place, and remembers the same completed encounter", () => {
    const { w, first, second } = scene();
    first.ties[0].bond = 69;
    step(w);
    expect(talkingPartner(w, first)).toBe(second);
    expect(talkingPartner(w, second)).toBe(first);
    first.nextDecision = second.nextDecision = 49;
    for (let i = 0; i < 26; i++) step(w);
    expect([first.x, second.x]).toEqual([12.5, 13.8]);
    expect(w.neighbourTalk).toBeUndefined();
    expect(w.chronicle[0].text).toMatch(/Mina et Gérard|Gérard et Mina/);
    expect(first.memories[0]).toBe(w.chronicle[0]);
    expect(second.memories[0]).toBe(w.chronicle[0]);
    expect(first.ties[0].bond).toBe(72);
    expect(second.ties.find((tie) => tie.id === first.id)?.bond).toBe(58);
    expect(first.cooldown).toBeGreaterThan(w.tick);
    step(w);
    expect(first.nextDecision).toBeGreaterThan(w.tick);
  });

  it("changes the subject during a shortage and interrupts without credit during a nearby fire", () => {
    const { w, first, second, update } = scene();
    w.water = 30;
    w.tick++;
    update();
    expect(w.neighbourTalk?.subject).toBe("shortage");
    const prior = w.chronicle[0];
    w.tick++;
    w.disasters = [
      { kind: "fire", x: second.x, y: second.y, life: 10, people: [] },
    ];
    expect(talkingPartner(w, first)).toBeUndefined();
    update();
    expect(w.neighbourTalk).toBeUndefined();
    expect(w.chronicle[0]).toBe(prior);
    expect(first.nextDecision).toBe(w.tick);
    expect(second.nextDecision).toBe(w.tick);
  });

  it.each(["walk", "rest", "thirst", "repair", "overlap", "night"] as const)(
    "does not begin during %s",
    (blocker) => {
      const { w, first, second, update } = scene();
      w.tick = 48;
      if (blocker === "walk") first.route = [[11, 12]];
      if (blocker === "rest") first.action = "Se repose à la maison";
      if (blocker === "thirst") first.thirst = 50;
      if (blocker === "repair") first.repairTarget = 8;
      if (blocker === "overlap") first.x = second.x;
      if (blocker === "night") w.tick = 192;
      update();
      expect(w.neighbourTalk).toBeUndefined();
    },
  );

  it("can pause a casual walk without moving either resident", () => {
    const { w, first, second, update } = scene();
    first.action = "Explore les berges";
    first.route = [[17.5, 16.5]];
    first.target = [17.5, 16.5];
    w.tick = 48;
    update();
    expect(talkingPartner(w, first)).toBe(second);
    expect(first.route).toEqual([]);
    expect(first.target).toEqual([12.5, 16.5]);
  });

  it("round-trips an active conversation, rejects invalid data and clears it on a session reset", () => {
    const { w } = scene();
    expect(restore(JSON.stringify(w)).neighbourTalk).toBeUndefined();
    step(w);
    const saved = restore(JSON.stringify(w));
    expect(talkingPartner(saved, saved.villagers[0])?.id).toBe(1);
    expect(() =>
      restore(
        JSON.stringify({
          ...w,
          neighbourTalk: { ...w.neighbourTalk, first: 1000 },
        }),
      ),
    ).toThrow();
    saved.settings.scenario = "session";
    newSession(saved, 1);
    expect(saved.neighbourTalk).toBeUndefined();
  });

  it("occurs without a seeded scene in a normal new village", () => {
    const natural = createWorld(0);
    for (let i = 0; i < 288 * 5; i++) step(natural);
    const conversations = natural.chronicle.filter((e) =>
      /échangent des conseils|se racontent un souvenir|se remontent le moral/.test(
        e.text,
      ),
    );
    expect(conversations.length).toBeGreaterThanOrEqual(2);
    expect(
      new Set(conversations.map((e) => e.person)).size,
    ).toBeGreaterThanOrEqual(2);
  });
});
