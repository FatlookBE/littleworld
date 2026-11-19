import { indoors } from "./home-visits";
import { findRoute } from "./navigation";
import type { World } from "./types";
import { isWet, season, seasonEffects } from "./seasons";
import { daylight } from "../daylight";
export type Species = "horned" | "wolf" | "wraith";
export interface Disaster {
  kind: "fire" | "monster" | "fight" | "quake" | "blight" | "plague";
  /** Monsters only; absent means the original horned creature. */
  species?: Species;
  x: number;
  y: number;
  life: number;
  people: number[];
  attackAt?: number;
  /** Fire only: ticks of water thrown by the bucket line. */
  doused?: number;
}
const DOUSING = "Jette de l’eau sur les flammes";
export function disasters(w: World): Disaster[] {
  return w.disasters ?? (w.disasters = []);
}
export function apocalypse(
  w: World,
  random: () => number,
  remember: (text: string, person?: number, kind?: "hope" | "warning") => void,
) {
  const events = disasters(w),
    alive = w.villagers.filter((v) => !v.dead && !indoors(v)),
    sparks: Disaster[] = [];
  for (const e of events) {
    e.life--;
    if (e.kind === "quake" || e.kind === "blight" || e.kind === "plague") {
      widespread(w, e, alive, random, remember);
      continue;
    }
    if (e.kind === "fight") {
      if (e.people.length !== 2 || e.people[0] === e.people[1]) {
        e.life = 0;
        continue;
      }
      const participants = e.people.map((id) => w.villagers[id]);
      if (participants.some((v) => !v || v.dead || indoors(v))) {
        e.life = 0;
        continue;
      }
      e.x = participants[0].x;
      e.y = participants[0].y;
      for (const v of participants) {
        v.route = [];
        v.target = [v.x, v.y];
        v.nextDecision = w.tick + 2;
      }
    }

    if (e.kind === "fire") {
      const b = w.buildings.find((b) => Math.hypot(b.x - e.x, b.y - e.y) < 1);
      if (b) b.condition = Math.max(0, b.condition - 0.08);
      // Stores, ovens and fields burn with the food they hold.
      if (b && ["market", "bakery", "farm"].includes(b.type))
        w.food = Math.max(0, w.food - 0.03);
      if (isWet(w)) e.life -= 3;
      bucketLine(w, e, events, alive, b?.name, remember);
      // A fire left burning in dry weather jumps to a nearby roof.
      if (w.tick % 30 === 0 && e.life > 0 && e.life < 340 && !isWet(w)) {
        const dry =
          Math.max(0, Math.min(1, (55 - w.moisture) / 55)) *
          seasonEffects[season(w.tick)].fire;
        const burning = (x: number, y: number) =>
          [...events, ...sparks].some(
            (o) =>
              o.kind === "fire" &&
              o.life > 0 &&
              Math.hypot(o.x - x, o.y - y) < 1,
          );
        const next = w.buildings
          .filter(
            (o) =>
              o.type !== "well" &&
              o.condition > 5 &&
              Math.hypot(o.x - e.x, o.y - e.y) < 5.5 &&
              !burning(o.x, o.y),
          )
          .sort(
            (a, c) =>
              Math.hypot(a.x - e.x, a.y - e.y) -
              Math.hypot(c.x - e.x, c.y - e.y),
          )[0];
        if (next && random() < 0.35 * dry) {
          sparks.push({
            kind: "fire",
            x: next.x,
            y: next.y,
            life: 400,
            people: [],
          });
          remember(`Le vent porte les flammes jusqu’à ${next.name}.`);
        }
      }
    }
    if (e.kind === "monster" && e.species === "wraith") {
      // Spectres drift toward the living and sap their courage; dawn dissolves them.
      if (daylight(w.tick) > 0.6) e.life = 0;
      const prey = alive.reduce<(typeof alive)[number] | undefined>(
        (best, v) =>
          !best ||
          Math.hypot(v.x - e.x, v.y - e.y) <
            Math.hypot(best.x - e.x, best.y - e.y)
            ? v
            : best,
        undefined,
      );
      if (prey) {
        const d = Math.hypot(prey.x - e.x, prey.y - e.y);
        if (d > 1) {
          e.x += ((prey.x - e.x) / d) * 0.03;
          e.y += ((prey.y - e.y) / d) * 0.03;
        }
      }
      for (const v of alive)
        if (Math.hypot(v.x - e.x, v.y - e.y) < 3.2) {
          v.morale = Math.max(0, v.morale - 0.35);
          v.energy = Math.max(0, v.energy - 0.08);
          if (w.tick % 20 === 0) v.action = "Frissonne devant une ombre pâle";
        }
    } else if (e.kind === "monster") {
      const speed = e.species === "wolf" ? 0.1 : 0.045,
        bite = e.species === "wolf" ? 2 : 3;
      const attacking = e.attackAt !== undefined && w.tick - e.attackAt < 8;
      const victim = attacking
        ? alive.find((v) => v.id === e.people[0])
        : alive.reduce<(typeof alive)[number] | undefined>(
            (best, v) =>
              !best ||
              Math.hypot(v.x - e.x, v.y - e.y) <
                Math.hypot(best.x - e.x, best.y - e.y)
                ? v
                : best,
            undefined,
          );
      if (victim) {
        const d = Math.hypot(victim.x - e.x, victim.y - e.y);
        if (attacking) {
          // Damage occurs once at the impact pose; a fleeing victim can evade it.
          if (w.tick === e.attackAt! + 4 && d <= 1.8) {
            victim.health = Math.max(0, victim.health - bite);
            victim.hitAt = w.tick;
            victim.hitSide = victim.x - e.x - (victim.y - e.y) >= 0 ? 1 : -1;
            victim.action = "Encaisse le coup d’une créature";
          }
        } else if (
          d <= 1.4 &&
          (e.attackAt === undefined || w.tick - e.attackAt >= 12)
        ) {
          e.attackAt = w.tick;
          e.people = [victim.id];
        } else if (d > 1) {
          e.x += ((victim.x - e.x) / d) * speed;
          e.y += ((victim.y - e.y) / d) * speed;
        }
      }
    }

    for (const v of alive) {
      const d = Math.hypot(v.x - e.x, v.y - e.y);
      if (d > 2.4) continue;
      v.morale = Math.max(0, v.morale - 0.12);
      v.energy = Math.max(0, v.energy - 0.04);
      if (e.kind === "fire" && e.people.includes(v.id)) continue;
      if (e.kind === "fight" && e.people.includes(v.id)) {
        v.action = "Se bat pour les dernières réserves";
        v.health = Math.max(0, v.health - 0.035);
        if (w.tick % 6 === (e.people.indexOf(v.id) === 0 ? 0 : 3)) {
          v.hitAt = w.tick;
          v.hitSide = e.people.indexOf(v.id) === 0 ? -1 : 1;
        }
      } else {
        if (v.hitAt !== w.tick)
          v.action =
            e.kind === "fire"
              ? "Fuit les flammes"
              : e.species === "wolf"
                ? "Fuit devant les loups"
                : e.kind === "fight"
                  ? "S’écarte de la bagarre"
                  : "Recule devant une créature";
        if (w.tick % 15 === 0) {
          const dx = v.x - e.x,
            dy = v.y - e.y,
            n = Math.hypot(dx, dy) || 1;
          v.route = findRoute(
            w,
            [v.x, v.y],
            [
              Math.max(0.5, Math.min(28.5, v.x + dx / n)),
              Math.max(0.5, Math.min(28.5, v.y + dy / n)),
            ],
          );
          v.target = v.route.at(-1) ?? [v.x, v.y];
          v.nextDecision = w.tick + 30;
        }
      }
    }
  }
  events.push(...sparks.slice(0, Math.max(0, 12 - events.length)));
  for (const e of events)
    if (e.kind === "fire" && e.life <= 0) {
      const crew = e.people.map((id) => w.villagers[id]).filter((v) => !v.dead);
      for (const v of crew) {
        v.action = "Reprend son souffle après l’incendie";
        v.nextDecision = w.tick + 20;
      }
      if ((e.doused ?? 0) > 0 && crew.length) {
        const b = w.buildings.find((b) => Math.hypot(b.x - e.x, b.y - e.y) < 1);
        w.cooperation = Math.min(100, w.cooperation + 3);
        for (const v of crew)
          for (const tie of v.ties)
            if (e.people.includes(tie.id))
              tie.bond = Math.min(100, tie.bond + 4);
        remember(
          `Le feu près de ${b?.name ?? "la place"} est éteint : ${names(crew)} ont fait la chaîne.`,
          crew[0].id,
          "hope",
        );
      }
    }
  w.disasters = events.filter((e) => e.life > 0);
  if (w.tick % 60 !== 0 || events.length >= 12) return;
  const p = w.pressure;
  if (
    p > 50 &&
    w.moisture < 48 * seasonEffects[season(w.tick)].fire &&
    random() < 0.65
  ) {
    const b = w.buildings[Math.floor(random() * w.buildings.length)];
    if (
      b.type !== "well" &&
      !events.some(
        (e) => e.kind === "fire" && Math.hypot(e.x - b.x, e.y - b.y) < 2,
      )
    ) {
      events.push({ kind: "fire", x: b.x, y: b.y, life: 400, people: [] });
      remember(
        `Le feu prend près de ${b.name}. Les voisins appellent à l’aide.`,
      );
    }
  }
  if (
    events.length < 12 &&
    p > 72 &&
    events.filter((e) => e.kind === "monster").length < 5 &&
    random() < 0.65
  ) {
    events.push({
      kind: "monster",
      x: 24,
      y: 4 + random() * 20,
      life: 1200,
      people: [],
    });
    remember("Une silhouette cornue sort de la forêt. Les enfants se cachent.");
  }
  const month = season(w.tick),
    night = daylight(w.tick) < 0.4;
  const has = (k: Disaster["kind"]) => events.some((e) => e.kind === k);
  if (
    events.length < 11 &&
    p > 55 &&
    (month === 3 || night) &&
    events.filter((e) => e.kind === "monster").length < 4 &&
    random() < 0.4
  ) {
    const y = 4 + random() * 20;
    for (const dy of [0, 1.5])
      events.push({
        kind: "monster",
        species: "wolf",
        x: 25,
        y: Math.min(28, y + dy),
        life: 700,
        people: [],
      });
    remember("Des hurlements dans la forêt : une meute approche du village.");
  }
  if (
    events.length < 12 &&
    p > 60 &&
    night &&
    !events.some((e) => e.species === "wraith") &&
    random() < 0.35
  ) {
    events.push({
      kind: "monster",
      species: "wraith",
      x: 3,
      y: 4 + random() * 20,
      life: 400,
      people: [],
    });
    remember(
      "Une ombre pâle glisse entre les maisons. Les chandelles vacillent.",
    );
  }
  if (events.length < 12 && p > 65 && !has("quake") && random() < 0.12) {
    events.push({ kind: "quake", x: 14, y: 14, life: 60, people: [] });
    remember("La terre tremble sous Val-des-Saules. Les poutres craquent.");
  }
  if (
    events.length < 12 &&
    p > 45 &&
    (month === 1 || month === 2) &&
    w.moisture < 55 &&
    !has("blight") &&
    random() < 0.3
  ) {
    events.push({ kind: "blight", x: 14, y: 14, life: 300, people: [] });
    remember("Un nuage de sauterelles s’abat sur les champs.");
  }
  if (
    events.length < 12 &&
    p > 55 &&
    w.food < 50 &&
    !has("plague") &&
    random() < 0.3
  ) {
    const first = alive[Math.floor(random() * alive.length)];
    if (first) {
      events.push({
        kind: "plague",
        x: 14,
        y: 14,
        life: 500,
        people: [first.id],
      });
      remember(
        `${first.name} est pris de fièvre. On redoute la contagion.`,
        first.id,
      );
    }
  }
  if (events.length < 12 && p > 42 && w.food < 40) {
    const a = alive[Math.floor(random() * alive.length)],
      b =
        a &&
        alive.find(
          (v) => v.id !== a.id && Math.hypot(v.x - a.x, v.y - a.y) < 2,
        );
    if (
      a &&
      b &&
      !events.some(
        (e) =>
          e.kind === "fight" &&
          (e.people.includes(a.id) || e.people.includes(b.id)),
      )
    ) {
      events.push({
        kind: "fight",
        x: a.x,
        y: a.y,
        life: 90,
        people: [a.id, b.id],
      });
      remember(
        `${a.name} et ${b.name} en viennent aux mains devant les réserves.`,
        a.id,
      );
      a.trust = Math.max(0, a.trust - 12);
    }
  }
  w.disasters = events.filter((e) => e.life > 0);
}

const names = (people: { name: string }[]) =>
  people.length === 1
    ? people[0].name
    : `${people
        .slice(0, -1)
        .map((v) => v.name)
        .join(", ")} et ${people.at(-1)!.name}`;

/**
 * Up to three neighbours run to a fire and throw water on it. Each bucket
 * shortens the fire but is taken from the shared reserve, so a dry village
 * can only watch its houses burn.
 */
function bucketLine(
  w: World,
  e: Disaster,
  events: Disaster[],
  alive: World["villagers"],
  place: string | undefined,
  remember: (text: string, person?: number, kind?: "hope" | "warning") => void,
) {
  const cx = e.x + 0.5,
    cy = e.y + 0.5;
  e.people = e.people.filter((id) => !w.villagers[id]?.dead);
  if (w.tick % 10 === 0 && e.people.length < 3 && w.water > 3) {
    const busy = new Set(
      events.flatMap((o) => (o.kind === "monster" ? [] : o.people)),
    );
    const recruits = alive
      .filter(
        (v) =>
          !busy.has(v.id) &&
          v.health > 40 &&
          v.morale > 20 &&
          v.thirst < 85 &&
          Math.hypot(v.x - cx, v.y - cy) < 9,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy),
      )
      .slice(0, 3 - e.people.length);
    const first = e.people.length === 0;
    for (const v of recruits) {
      e.people.push(v.id);
      const angle = e.people.length * 2.1 + e.x;
      v.route = findRoute(
        w,
        [v.x, v.y],
        [
          Math.max(0.5, Math.min(28.5, cx + Math.cos(angle) * 1.6)),
          Math.max(0.5, Math.min(28.5, cy + Math.sin(angle) * 1.6)),
        ],
      );
      v.target = v.route.at(-1) ?? [v.x, v.y];
      v.action = "Court avec des seaux vers le feu";
      v.nextDecision = w.tick + 60;
    }
    if (first && recruits.length)
      remember(
        `${names(recruits)} ${recruits.length > 1 ? "forment" : "forme"} une chaîne de seaux près de ${place ?? "l’incendie"}.`,
        recruits[0].id,
        "hope",
      );
  }
  for (const id of [...e.people]) {
    const v = w.villagers[id];
    if (w.water <= 2) {
      v.action = "Regarde brûler, faute d’eau";
      v.nextDecision = w.tick + 10;
      e.people = e.people.filter((p) => p !== id);
      continue;
    }
    if (Math.hypot(v.x - cx, v.y - cy) < 2.6) {
      e.life -= 2.5;
      e.doused = (e.doused ?? 0) + 1;
      w.water = Math.max(0, w.water - 0.035);
      v.energy = Math.max(0, v.energy - 0.05);
      v.action = DOUSING;
      v.route = [];
      v.target = [v.x, v.y];
      v.nextDecision = w.tick + 5;
    } else {
      v.nextDecision = Math.max(v.nextDecision ?? 0, w.tick + 10);
      if (!v.route.length) {
        v.route = findRoute(w, [v.x, v.y], [cx, cy]);
        v.target = v.route.at(-1) ?? [v.x, v.y];
        // Unreachable fire: give up instead of standing still forever.
        if (Math.hypot(v.target[0] - cx, v.target[1] - cy) >= 2.6)
          e.people = e.people.filter((p) => p !== id);
      }
    }
  }
}

/** Disasters that strike the whole village rather than a spot on the map. */
function widespread(
  w: World,
  e: Disaster,
  alive: World["villagers"],
  random: () => number,
  remember: (text: string, person?: number, kind?: "hope" | "warning") => void,
) {
  if (e.kind === "quake") {
    for (const b of w.buildings) b.condition = Math.max(0, b.condition - 0.12);
    for (const v of alive) v.morale = Math.max(0, v.morale - 0.08);
    if (e.life === 0)
      remember("Le tremblement s’apaise ; les maisons tiennent, abîmées.");
  } else if (e.kind === "blight") {
    w.food = Math.max(0, w.food - 0.03);
    w.vegetation = Math.max(0, w.vegetation - 0.04);
    if (isWet(w)) e.life -= 2;
    if (e.life <= 0)
      remember("Les sauterelles repartent, laissant des champs ras.");
  } else {
    e.people = e.people.filter((id) => !w.villagers[id]?.dead);
    for (const id of e.people) {
      const v = w.villagers[id];
      v.health = Math.max(0, v.health - 0.03);
      v.route = [];
      v.target = [v.x, v.y];
      v.nextDecision = w.tick + 5;
      v.action = "Alité, brûlant de fièvre";
      if (w.tick % 40 === 0 && e.people.length < 5 && random() < 0.5) {
        const next = alive.find(
          (o) =>
            !e.people.includes(o.id) && Math.hypot(o.x - v.x, o.y - v.y) < 2.5,
        );
        if (next) {
          e.people.push(next.id);
          remember(`${next.name} tombe malade à son tour.`, next.id);
        }
      }
    }
    if (!e.people.length) e.life = 0;
    if (e.life <= 0 && e.people.length)
      remember(
        "La fièvre retombe. Les malades se relèvent, amaigris.",
        e.people[0],
        "hope",
      );
  }
}
