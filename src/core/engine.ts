import { field } from "../village-layout";
import { growCrops } from "./crops";
import { finishHarvest, harvestJob, harvestAction } from "./harvest";
import { indoors, needsHomeCare } from "./shelter";
import {
  growResident,
  relocateInfant,
  welcomeChild,
  villageCapacity,
} from "./population";
import {
  canRebuild,
  reconstructionJob,
  repairAtDestination,
} from "./reconstruction";
import {
  doorStep,
  cancelVisit,
  tryHomeVisit,
  updateHomeVisit,
} from "./home-visits";
import { updateLocalEnvironment, buildingWear } from "./local-environment";
import { updateNutrition } from "./nutrition";
import { spreadDestination, moveResident } from "./crowd";
import { apocalypse } from "./apocalypse";
import { sendFireWater } from "./fire-aid";
import { swapMarketGoods } from "./market";
import { finishDailyBread } from "./bakery";
import { clinicDestination, deliverClinicCare } from "./clinic";
import { advanceNeighbourTalk, talkingPartner } from "./neighbour-talk";
import { collectRainwater } from "./rain-collection";
import { advanceVillageStories } from "./village-stories";
import type { World, Memory, Villager, Scenario } from "./types";
import {
  totals,
  ingest,
  DemoAdapter,
  dailyFresh,
  effectiveBudget,
  freshTokens,
  isAdaptive,
} from "./telemetry";
import { findRoute, riverCenter } from "./navigation";
import {
  isSeasonStart,
  isWet,
  season,
  seasonEffects,
  seasonalWeather,
  seasonArrival,
  seasonProgress,
} from "./seasons";

export const milestoneNames = [
  "Floraison",
  "Premiers signes",
  "Sécheresse",
  "Pénurie",
  "Effondrement",
  "Terre silencieuse",
];
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export function random(w: World) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}
export function stage(w: World) {
  return w.settings.thresholds.filter((v) => w.pressure >= v).length;
}
export const residents = (w: World) => w.villagers.filter((v) => !v.dead);
function die(w: World, v: Villager) {
  if (v.dead) return;
  if (v.visit) cancelVisit(w, v);
  delete v.repairTarget;
  v.dead = true;
  v.diedAt = w.tick;
  v.health = 0;
  v.route = [];
  v.target = [v.x, v.y];
  v.action = "Décédé — repose dans le village";
  delete v.hitAt;
  delete v.hitSide;
  note(
    w,
    `${v.name} s’effondre. Son corps reste dans le village.`,
    "warning",
    v.id,
  );
}
export function note(
  w: World,
  text: string,
  kind: Memory["kind"] = "ordinary",
  person?: number,
) {
  const event: Memory = {
    tick: w.tick,
    text,
    kind,
    ...(person === undefined ? {} : { person }),
  };
  w.chronicle.unshift(event);
  w.chronicle.length = Math.min(w.chronicle.length, 160);
  if (person !== undefined) {
    const v = w.villagers[person];
    v.memories.unshift(event);
    v.memories.length = Math.min(v.memories.length, 24);
  }
  return event;
}
export function harvestRainwater(w: World, buildingId: number) {
  const collected = collectRainwater(w, buildingId);
  if (!collected) return null;
  const text = `L’eau des seaux rejoint la réserve (+${collected.amount} points d’eau).`;
  collected.site.events.unshift(note(w, text, "hope"));
  collected.site.events.length = Math.min(collected.site.events.length, 12);
  return text;
}
export function supportFireCrew(w: World, buildingId: number) {
  const site = sendFireWater(w, buildingId);
  if (!site) return null;
  const text = `Un renfort d’eau affaiblit l’incendie près de « ${site.name} ».`;
  site.events.unshift(note(w, text, "hope"));
  site.events.length = Math.min(site.events.length, 12);
  return text;
}
export function tradeAtMarket(w: World, buildingId: number) {
  const trade = swapMarketGoods(w, buildingId);
  if (!trade) return null;
  const { site, offer } = trade;
  const text = `Troc à la Halle : ${offer.terms}.`;
  site.events.unshift(note(w, text, "ordinary"));
  site.events.length = Math.min(site.events.length, 12);
  return text;
}
export function createWorld(now = Date.now(), seed = 9137): World {
  const buildings = [
    ["Maison des saules", "home", 8, 9],
    ["Maison du pont", "home", 11, 7],
    ["Maison des tuiles", "home", 17, 8],
    ["Maison du verger", "home", 20, 11],
    ["Maison des oiseaux", "home", 20, 16],
    ["Maison du jardin", "home", 15, 19],
    ["Maison des collines", "home", 9, 18],
    ["Maison de Mina", "home", 6, 14],
    ["Le puits commun", "well", 13, 13],
    ["Les terres de Gérard", "farm", 7, 20],
    ["La Halle", "market", 16, 13],
    ["Le pain quotidien", "bakery", 13, 8],
    ["La maison de soin", "clinic", 18, 19],
    ["La réserve", "reservoir", 23, 8],
    ["L’atelier", "workshop", 8, 6],
  ].map(([name, type, x, y], id) => ({
    id,
    name: String(name),
    type: String(type),
    x: Number(x),
    y: Number(y),
    condition: 100,
    events: [],
  }));
  const names = [
    "Gérard",
    "Mina",
    "Alma",
    "Émile",
    "Suzanne",
    "Noé",
    "Rose",
    "Lucien",
    "Inès",
    "Basile",
    "Jeanne",
    "Marcel",
    "Lou",
    "Oscar",
    "Ada",
    "Sami",
    "Léonie",
    "Félix",
    "Nora",
    "Jules",
    "Iris",
    "André",
    "Lila",
    "Paul",
  ];
  const roles = [
    "Maraîcher",
    "Boulangère",
    "Porteuse d’eau",
    "Charpentier",
    "Infirmière",
    "Apprenti",
    "Jardinière",
    "Marchand",
  ];
  const w: World = {
    version: 1,
    seed,
    tick: 0,
    savedAt: now,
    session: `local-${now}`,
    day: new Date(now).toISOString().slice(0, 10),
    settings: {
      budget: 100000,
      curve: 1,
      thresholds: [15, 35, 55, 75, 95],
      scenario: "persistent",
      reducedMotion: false,
      storyCamera: true,
      eventFrequency: 1,
      retentionDays: 30,
      includeInput: true,
      includeOutput: true,
      adaptive: true,
    },
    usage: [],
    pressure: 0,
    relief: 0,
    lastUsageTick: 0,
    water: 96,
    food: 88,
    moisture: 95,
    fertility: 95,
    vegetation: 100,
    air: 100,
    cooperation: 74,
    unrest: 0,
    weather: "Ciel clair",
    villagers: [],
    buildings,
    chronicle: [],
    milestones: [0],
    replayIndex: 0,
    replayOn: false,
    snapshots: [],
  };
  w.villagers = names.map((name, id) => {
    const home = buildings[Math.floor(id / 3)];
    const x = home.x + 0.5 + (id % 3) * 0.15,
      y = home.y + 2.5;
    return {
      id,
      name,
      age: 19 + ((id * 7) % 59),
      role: roles[id % roles.length],
      home: home.id,
      household: Math.floor(id / 3),
      x,
      y,
      target: [x, y],
      route: [],
      action: "Profite de la matinée",
      hunger: 10,
      malnutrition: 0,
      thirst: 10,
      energy: 95,
      health: 100,
      morale: 90,
      trust: 70,
      resilience: 40 + random(w) * 50,
      dead: false,
      ties: [
        { id: (id + 1) % 24, bond: 75, favors: 0 },
        { id: (id + 23) % 24, bond: 55, favors: 0 },
        { id: (id + 7) % 24, bond: 25, favors: 0 },
      ],
      memories: [
        {
          tick: 0,
          text: "A posé ses valises à Val-des-Saules.",
          kind: "ordinary",
        },
      ],
      cooldown: 20 + id * 4,
    };
  });
  note(
    w,
    "Une nouvelle matinée à Val-des-Saules. Le pain est encore chaud.",
    "hope",
  );
  return w;
}
function destination(w: World, v: Villager) {
  const hour = (w.tick / 12 + 8) % 24;
  delete v.repairTarget;
  let target: [number, number], action: string;
  const clinic = clinicDestination(w, v);
  if (clinic) {
    ({ target, action } = clinic);
  } else if (v.thirst > 45) {
    // The riverside pools are only worth the walk while the river still runs.
    const waterStops: [number, number][] = [
      [13.5, 14.5],
      [24.5, 11.5],
      ...(w.water > 8
        ? ([
            [riverCenter(6) + 2.2, 6.5],
            [riverCenter(23) + 2.2, 23.5],
          ] as [number, number][])
        : []),
    ];
    target = waterStops.reduce((a, b) =>
      Math.hypot(a[0] - v.x, a[1] - v.y) < Math.hypot(b[0] - v.x, b[1] - v.y)
        ? a
        : b,
    );
    action =
      target === waterStops[0]
        ? "Attend son tour au puits"
        : "Boit au point d’eau";
  } else if (v.hunger > 50) {
    target =
      v.x < 5 || v.x > 23 || v.y < 5 || v.y > 23 ? [v.x, v.y] : [16, 16.5];
    action =
      w.food < 20
        ? "Cherche quelque chose à manger"
        : "Prend un repas avec ses provisions";
  } else if (
    v.energy < 25 ||
    hour < 6 ||
    hour > 21 ||
    (w.tick >= (v.visitAfter ?? 0) &&
      (Math.floor(w.tick / 12) + v.id) % 19 === 0)
  ) {
    const h = w.buildings[v.home];
    target = doorStep(h);
    action = "Se repose à la maison";
  } else if (v.age < 18) {
    const home = w.buildings[v.home];
    target = [home.x + 0.5 + (v.id % 2 ? 2 : -1), home.y + 3.5];
    action = "Joue près de sa maison";
  } else {
    const repair = v.age >= 18 ? reconstructionJob(w, v) : undefined;
    const repairRoute = repair && findRoute(w, [v.x, v.y], repair.target);
    const repairStop = repairRoute && repairRoute.at(-1);
    if (
      repair &&
      repairRoute &&
      repairStop &&
      Math.hypot(
        repairStop[0] - repair.target[0],
        repairStop[1] - repair.target[1],
      ) < 0.1
    ) {
      v.repairTarget = repair.b.id;
      v.action = `Reconstruit ${repair.b.name}`;
      v.actionAt = w.tick;
      v.route = repairRoute;
      v.target = repairStop;
      v.nextDecision = w.tick + 40;
      return;
    }
    const job = v.id % 8;
    if (job === 0) {
      const work = harvestJob(w, v);
      if (work) {
        const route = findRoute(w, [v.x, v.y], work);
        const stop = route.at(-1);
        if (stop?.[0] === work[0] && stop[1] === work[1]) {
          v.route = route;
          v.target = stop;
          v.action = harvestAction;
          v.actionAt = w.tick;
          v.nextDecision = w.tick + 40;
          return;
        }
      }
    }
    const spots: [number, number][] = [
      [field.x + 1.5 + (v.id % 3), field.y + 0.5],
      [13, 10.5],
      [13, 14],
      [8, 8.5],
      [18, 21.5],
      [8, 8.5],
      [10, 21],
      [16, 16.5],
    ];
    target = spots[job];
    action = [
      "Veille sur les cultures",
      "Pétrit le pain",
      "Porte de l’eau à ses voisins",
      "Répare les toitures",
      "Soigne ses voisins",
      "Aide à l’atelier",
      "Prend soin du verger",
      "Ouvre son étal",
    ][job];
    if (w.water < 25 && job === 0) action = "Tente de sauver la récolte";
    if (w.food < 15 && job === 7) action = "Compte ses dernières provisions";
    if (random(w) < 0.55) {
      // Work and leisure destinations span both banks and all edges of the island.
      const regions: [number, number][] = [
        [1.5, 3.5],
        [1.5, 12.5],
        [1.5, 25.5],
        [9.5, 2.5],
        [19.5, 2.5],
        [26.5, 4.5],
        [27.5, 15.5],
        [25.5, 25.5],
        [14.5, 27.5],
        [5.5, 27.5],
        [13.5, 15.5],
      ];
      target = regions[Math.floor(random(w) * regions.length)];
      action = [
        "Explore les berges",
        "Ramasse du bois dans la forêt",
        "Inspecte les chemins",
        "Cueille des plantes sauvages",
      ][v.id % 4];
    }
  }
  v.action = action;
  v.actionAt = w.tick;
  v.route = findRoute(w, [v.x, v.y], spreadDestination(w, v, target));
  v.target = v.route.at(-1) ?? [v.x, v.y];
  v.nextDecision = w.tick + 40;
}
function social(w: World, v: Villager) {
  if (v.ties.length === 0 || v.visit) return;
  if (v.cooldown > w.tick || random(w) > 0.012 * w.settings.eventFrequency)
    return;
  const tie = v.ties[Math.floor(random(w) * v.ties.length)],
    other = w.villagers[tie.id];
  if (other.dead || other.visit || talkingPartner(w, other)) return;
  const near = Math.hypot(v.x - other.x, v.y - other.y) < 3;
  if (!near) return;
  if (w.water < 40 && other.thirst > 50 && tie.bond > 40 && v.thirst < 65) {
    other.thirst = clamp(other.thirst - 25);
    v.thirst = clamp(v.thirst + 10);
    tie.favors++;
    tie.bond = clamp(tie.bond + 5);
    w.cooperation = clamp(w.cooperation + 2);
    const e = note(
      w,
      `${v.name} partage sa gourde avec ${other.name}.`,
      "hope",
      v.id,
    );
    other.memories.unshift(e);
  } else if (w.food < 25 && v.hunger > 55 && tie.bond < 35) {
    tie.bond = clamp(tie.bond - 8);
    v.trust = clamp(v.trust - 5);
    w.unrest = clamp(w.unrest + 4);
    const e = note(
      w,
      `${v.name} et ${other.name} se disputent une place dans la file.`,
      "warning",
      v.id,
    );
    other.memories.unshift(e);
  } else if (w.pressure < 55 && tie.favors > 0) {
    tie.favors--;
    tie.bond = clamp(tie.bond + 8);
    v.morale = clamp(v.morale + 8);
    note(
      w,
      `${v.name} rend un service à ${other.name}. On n’a pas oublié.`,
      "hope",
      v.id,
    );
  } else if (w.cooperation > 60 && w.water < 65) {
    w.water = clamp(w.water + 0.25);
    v.action = "Aide à réparer la pompe";
    w.buildings[8].condition = clamp(w.buildings[8].condition + 3);
    const e = note(
      w,
      `${v.name} et ${other.name} remettent la pompe en état.`,
      "hope",
      v.id,
    );
    w.buildings[8].events.unshift(e);
  } else return;
  v.cooldown = w.tick + 200;
  other.cooldown = w.tick + 120;
  other.memories.length = Math.min(other.memories.length, 24);
  w.buildings[8].events.length = Math.min(w.buildings[8].events.length, 12);
}
export function step(w: World) {
  w.tick++;
  if (isSeasonStart(w.tick)) note(w, seasonArrival[season(w.tick)], "ordinary");
  if (w.replay) {
    const replay = w.replay;
    let processed = 0;
    while (
      replay.cursor < replay.events.length &&
      processed < 100 &&
      Date.parse(replay.events[replay.cursor].at) - replay.firstAt <=
        (w.tick - replay.startedTick) * 200
    ) {
      ingest(w, replay.events[replay.cursor++]);
      processed++;
    }
    if (replay.cursor >= replay.events.length) {
      delete w.replay;
      note(w, "Le replay importé est terminé.", "ordinary");
    }
  }
  if (w.replayOn && w.tick % 20 === 0 && w.replayIndex < 100) {
    ingest(w, new DemoAdapter().event(w, Math.round(w.settings.budget / 95)));
    w.replayIndex++;
    if (w.replayIndex === 100) {
      w.replayOn = false;
      note(
        w,
        "La démonstration est terminée. Le village, lui, continue.",
        "ordinary",
      );
    }
  }
  const daily = dailyFresh(w);
  const budget = (w.budgetNow = effectiveBudget(w, daily));
  const tokens = isAdaptive(w)
    ? (daily.get(w.day) ?? 0)
    : freshTokens(
        totals(
          w,
          w.settings.scenario === "persistent"
            ? "lifetime"
            : w.settings.scenario === "daily"
              ? "day"
              : "session",
        ),
        w.settings,
      );
  if (w.tick - w.lastUsageTick > 100)
    w.relief = clamp(w.relief + 0.025 + w.cooperation * 0.00015);
  const usagePressure = Math.pow(tokens / budget, w.settings.curve) * 100;
  // Daily overages survive recovery. Fixed scenarios allow recovery even over a lifetime budget.
  const target = clamp(
    (isAdaptive(w) ? usagePressure : clamp(usagePressure)) - w.relief,
  );
  w.pressure += (target - w.pressure) * 0.012;
  const p = w.pressure / 100,
    alive = residents(w);
  w.weather = seasonalWeather(w, p);
  const rain = isWet(w) ? 0.1 : 0;
  const now = season(w.tick),
    effects = seasonEffects[now];
  // A good season only helps a healthy land: drought wipes out the bonus.
  const harvest =
    effects.harvest > 1
      ? 1 + (effects.harvest - 1) * (1 - p) ** 2
      : effects.harvest;
  if (w.tick > 1 && seasonProgress(w.tick) === 0)
    note(
      w,
      [
        "Le printemps revient : les bourgeons percent et la neige fond.",
        "L’été s’installe. La rivière s’évapore plus vite.",
        "L’automne dore les arbres. C’est le temps des récoltes.",
        "L’hiver tombe sur Val-des-Saules. Les greniers doivent tenir.",
      ][now],
      now === 3 ? "warning" : "ordinary",
    );
  w.moisture = clamp(w.moisture + (100 * (1 - p) - w.moisture) * 0.006 + rain);
  w.fertility = clamp(w.fertility + (w.moisture - w.fertility) * 0.002);
  w.vegetation = clamp(w.vegetation + (w.moisture - w.vegetation) * 0.003);
  w.air = clamp(100 - p * 70);
  w.water = clamp(
    w.water +
      (0.21 * (1 - p) * (w.buildings[8].condition / 100) +
        rain -
        0.11 * (alive.length / villageCapacity) -
        p * 0.12 -
        effects.evaporation),
  );
  w.food = clamp(
    w.food +
      (((0.2 * w.fertility) / 100) * (1 - p * 0.65) * harvest -
        (0.105 * alive.length) / villageCapacity),
  );
  w.unrest = clamp(
    w.unrest +
      ((100 - w.water) * 0.0006 +
        (100 - w.food) * 0.0007 -
        (0.06 * w.cooperation) / 100),
  );
  updateLocalEnvironment(w);
  growCrops(w);
  for (const b of w.buildings) {
    const wear = buildingWear(w, b);
    b.condition = clamp(
      b.condition - Math.max(0, p - 0.2) * 0.16 * wear.exposure + wear.repair,
    );
  }
  for (const v of alive) {
    if (growResident(w, v))
      note(
        w,
        `${v.name} atteint l’âge adulte et commence à travailler au village.`,
        "hope",
        v.id,
      );
    if (v.health <= 0) {
      die(w, v);
      continue;
    }
    v.actionAt ??= w.tick;
    v.thirst = clamp(v.thirst + 0.12 + p * 0.16);
    v.hunger = clamp(v.hunger + 0.09 + p * 0.08);
    v.energy = clamp(v.energy - 0.04);
    if (v.repairTarget !== undefined) {
      const site = w.buildings[v.repairTarget];
      if (
        !site ||
        !v.action.startsWith("Reconstruit") ||
        !canRebuild(w, v, site)
      ) {
        delete v.repairTarget;
        if (v.action.startsWith("Reconstruit")) {
          v.action = "Interrompt la reconstruction";
          v.actionAt = w.tick;
          v.route = [];
          v.target = [v.x, v.y];
          v.nextDecision = w.tick;
        }
      }
    }
    const young = needsHomeCare(v);
    if (young) {
      const shelter = relocateInfant(w, v);
      if (shelter)
        note(w, `${v.name} est mis à l’abri à ${shelter.name}.`, "hope", v.id);
      if (w.food > 1) {
        v.hunger = clamp(v.hunger - 0.24);
        w.food = clamp(w.food - 0.008);
      }
      if (w.water > 1) {
        v.thirst = clamp(v.thirst - 0.28);
        w.water = clamp(w.water - 0.008);
      }
    }
    const occupied =
      young || updateHomeVisit(w, v) || Boolean(talkingPartner(w, v));
    if (!occupied) {
      if (
        (!v.route.length && w.tick >= (v.nextDecision ?? 0)) ||
        (v.thirst > 60 &&
          !v.action.includes("puits") &&
          !v.action.includes("point d’eau") &&
          w.tick >= (v.nextDecision ?? 0)) ||
        (v.hunger > 75 &&
          !/repas|manger/.test(v.action) &&
          w.tick >= (v.nextDecision ?? 0))
      )
        destination(w, v);
      const wasTravelling = v.route.length > 0;
      moveResident(w, v, 0.11 * (0.6 + v.energy / 250));
      if (wasTravelling && v.route.length === 0) {
        v.actionAt = w.tick;
        // Give work and needs a real stop after arrival, even after a long trip.
        v.nextDecision = Math.max(
          v.nextDecision ?? 0,
          w.tick + 24 + (v.id % 12),
        );
      }
      tryHomeVisit(w, v);
    }
    const arrived = Math.hypot(v.x - v.target[0], v.y - v.target[1]) < 0.3;
    if (arrived) {
      const rebuilt = repairAtDestination(w, v);
      if (rebuilt) {
        rebuilt.events.unshift(
          note(
            w,
            `${v.name} termine une étape de la reconstruction de ${rebuilt.name}.`,
            "hope",
            v.id,
          ),
        );
        rebuilt.events.length = Math.min(12, rebuilt.events.length);
      }
      if (
        (v.action.includes("puits") || v.action.includes("point d’eau")) &&
        w.water > 1
      ) {
        v.thirst = clamp(v.thirst - 2);
        w.water = clamp(w.water - 0.015);
      }
      if (
        (v.action.includes("repas") || v.action.includes("manger")) &&
        w.food > 1
      ) {
        v.hunger = clamp(v.hunger - 2);
        w.food = clamp(w.food - 0.015);
      }
      if (v.action.includes("repose"))
        v.energy = clamp(v.energy + (indoors(v, w) ? 1.3 : 1));
    }
    updateNutrition(v);
    v.morale = clamp(
      v.morale +
        0.025 * (w.cooperation / 100) -
        (v.thirst > 65 ? 0.07 : 0) -
        (v.hunger > 65 ? 0.065 : 0) -
        p * 0.025,
    );
    v.health = clamp(
      v.health + (v.thirst > 85 || v.hunger > 90 ? -0.12 : 0.025),
    );
    if (!talkingPartner(w, v)) social(w, v);
    if (
      w.food < 35 &&
      v.id % 8 === 0 &&
      !v.memories.some((e) => e.text.includes("récolte"))
    )
      note(w, `${v.name} a perdu une partie de sa récolte.`, "warning", v.id);
    if (v.health <= 0) die(w, v);
  }
  apocalypse(
    w,
    () => random(w),
    (text, person, kind = "warning") => note(w, text, kind, person),
  );
  for (const v of residents(w)) if (v.health <= 0) die(w, v);
  const care = deliverClinicCare(w);
  if (care) {
    const { site, nurse, patient, cost, gain } = care;
    const memory = note(
      w,
      `${nurse.name} soigne ${patient.name} : +${gain} santé, −${cost} à la réserve d’eau.`,
      "hope",
      patient.id,
    );
    site.events.unshift(memory);
    site.events.length = Math.min(site.events.length, 12);
    nurse.memories.unshift(memory);
    nurse.memories.length = Math.min(nurse.memories.length, 24);
  }
  const bread = finishDailyBread(w);
  if (bread) {
    bread.site.events.unshift(
      note(
        w,
        `${bread.baker.name} sort le pain du four : +${bread.breadYield} au garde-manger, −${bread.waterCost} à la réserve d’eau.`,
        "hope",
        bread.baker.id,
      ),
    );
    bread.site.events.length = Math.min(bread.site.events.length, 12);
  }
  for (const v of alive) {
    const harvest = finishHarvest(w, v);
    if (!harvest) continue;
    const { farm, row, food } = harvest;
    farm.events.unshift(
      note(
        w,
        `${v.name} rentre la récolte du rang ${row + 1} : +${food} au garde-manger.`,
        "hope",
        v.id,
      ),
    );
    farm.events.length = Math.min(farm.events.length, 12);
  }
  advanceNeighbourTalk(w, (text, kind, person) => note(w, text, kind, person));
  const child = welcomeChild(w);
  if (child)
    note(
      w,
      `${child.name} vient de naître. Le village accueille un nouvel enfant.`,
      "hope",
      child.id,
    );
  if (!isSeasonStart(w.tick))
    advanceVillageStories(w, (text, kind, person) => note(w, text, kind, person));
  const s = stage(w);
  if (!w.milestones.includes(s)) {
    w.milestones.push(s);
    note(
      w,
      `${milestoneNames[s]}. ${["La vie reprend ses droits.", "Le courant ralentit sous le pont.", "La terre a soif.", "Les files s’allongent au puits.", "Les réserves ne suffisent plus.", "Le vent traverse les maisons vides."][s]}`,
      s < 2 ? "ordinary" : "warning",
    );
  }
  if (
    w.water < 10 &&
    !w.chronicle.some((e) => e.text.includes("fond du puits"))
  )
    note(w, "Pour la première fois, on voit le fond du puits.", "warning");
}
export function intervene(w: World) {
  if (w.relief >= 95) return false;
  w.relief = clamp(w.relief + 12);
  w.water = clamp(w.water + 8);
  w.cooperation = clamp(w.cooperation + 6);
  const v = residents(w).find((v) => v.morale < 70) ?? residents(w)[0];
  if (v) {
    v.morale = clamp(v.morale + 12);
    note(
      w,
      `${v.name} organise une journée d’entraide. Un arbre est planté.`,
      "hope",
      v.id,
    );
  }
  return true;
}
export function newSession(w: World, now = Date.now()) {
  delete w.replay;
  w.replayOn = false;
  w.snapshots.unshift({
    tick: w.tick,
    population: residents(w).length,
    pressure: w.pressure,
    session: w.session,
  });
  w.snapshots.length = Math.min(w.snapshots.length, 20);
  w.session = `local-${now}`;
  w.replayIndex = 0;
  if (w.settings.scenario === "session") {
    delete w.disasters;
    delete w.stories;
    delete w.rainCollectedAt;
    delete w.marketTradedAt;
    delete w.breadBakedAt;
    delete w.clinicTreatedAt;
    delete w.neighbourTalk;
    const fresh = createWorld(now, w.seed);
    Object.assign(w, {
      ...fresh,
      settings: w.settings,
      usage: w.usage,
      snapshots: w.snapshots,
    });
  }
}
export function setScenario(w: World, scenario: Scenario) {
  w.settings.scenario = scenario;
  w.relief = 0;
}
export function catchUp(w: World, now = Date.now()) {
  const seconds = Math.max(0, (now - w.savedAt) / 1000);
  const before = w.tick;
  w.day = new Date(now).toISOString().slice(0, 10);
  // At most one minute of normal simulation; no replay usage during offline time.
  const replay = w.replayOn,
    external = w.replay;
  w.replayOn = false;
  delete w.replay;
  for (let i = 0; i < Math.min(300, Math.floor(seconds * 5)); i++) step(w);
  w.replayOn = replay;
  if (external) {
    external.startedTick += w.tick - before;
    w.replay = external;
  }
  w.savedAt = now;
}
export function syncDay(w: World, now = Date.now()) {
  w.day = new Date(now).toISOString().slice(0, 10);
}
