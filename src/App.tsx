import { bridgeLight } from "./bridge-lights";
import { talkingPartner } from "./core/neighbour-talk";
import { youthStage } from "./young-residents";
import { villageCapacity } from "./core/population";
import { LocalDiagnostics } from "./LocalDiagnostics";
import { VillageAudioSettings } from "./VillageAudioSettings";
import { useVillageAudio } from "./use-village-audio";
import {
  villageCauses,
  personCauses,
  buildingCauses,
  type VillageCause,
} from "./core/village-causes";
import { readUsageBridge } from "./usage-bridge";
import { remainsLabel } from "./core/lifecycle";
import { residentSkin } from "./sprites";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  createWorld,
  step,
  stage,
  milestoneNames,
  residents,
  intervene,
  newSession,
  setScenario,
  catchUp,
  harvestRainwater,
  supportFireCrew,
  tradeAtMarket,
  note,
  syncDay,
} from "./core/engine";
import {
  totals,
  selectedUsage,
  usageSessionKey,
  effectiveBudget,
  isAdaptive,
  ADAPTIVE_DAYS,
  adaptiveFloor,
  DemoAdapter,
  ReplayAdapter,
  CodexAdapter,
  ClaudeAdapter,
  syncUsage,
  dailyFresh,
  ingest,
} from "./core/telemetry";
import { loadWorld, saveWorld, restore } from "./core/persistence";
import type { World, Scenario } from "./core/types";
import { WorldRenderer } from "./world";
import { storyCue, storyLandmarks } from "./story-scene";
import { giveResidentAid, residentAidOptions } from "./core/resident-aid";
import { marketOffer } from "./core/market";
import { bakeryState, breadDisplayPosition } from "./core/bakery";
import { fireAid } from "./core/fire-aid";
import { rainCollection } from "./core/rain-collection";
import { contributeToStory, storyAid } from "./core/village-stories";
import { daylight } from "./daylight";
import { daysToNextSeason, season, seasonNames } from "./core/seasons";
import "./App.css";

type Panel = "settings" | "chronicle" | "residents" | "about" | "data" | null;
type Selection = { kind: "person" | "building"; id: number } | null;
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const clock = (tick: number) => {
  const h = (8 + tick / 12) % 24;
  return `${Math.floor(h).toString().padStart(2, "0")}:${Math.floor(
    (h % 1) * 60,
  )
    .toString()
    .padStart(2, "0")}`;
};
function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Meter({
  label,
  value,
  reverse = false,
}: {
  label: string;
  value: number;
  reverse?: boolean;
}) {
  return (
    <div className="need">
      <span>{label}</span>
      <meter
        min="0"
        max="100"
        value={Math.round(reverse ? 100 - value : value)}
      />
      <small>{Math.round(reverse ? 100 - value : value)}%</small>
    </div>
  );
}
function CauseList({
  title,
  causes,
}: {
  title: string;
  causes: VillageCause[];
}) {
  return (
    <section className="cause-explanation" aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {causes.map((cause) => (
          <li key={cause.id}>
            <strong>{cause.title}</strong>
            <p>{cause.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
function tokenSourceLabel(events: ReturnType<typeof selectedUsage>) {
  const sources = new Set(events.map((event) => event.provenance));
  if (!sources.size) return "Aucun relevé";
  if (sources.size > 1) return "Sources mixtes";
  if (sources.has("measured")) return "Tokens mesurés";
  if (sources.has("estimated")) return "Tokens estimés";
  return "Tokens simulés";
}

function App() {
  const [view, setView] = useState<World>(() => createWorld());
  const world = useRef<World>(view),
    canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<WorldRenderer | null>(null);
  const focusStoryButton = useRef<HTMLButtonElement>(null),
    interfaceButton = useRef<HTMLButtonElement>(null),
    chronicleHeading = useRef<HTMLHeadingElement>(null),
    drawer = useRef<HTMLElement>(null),
    openedFromFocus = useRef(false);
  const [ready, setReady] = useState(false),
    [paused, setPaused] = useState(false),
    [speed, setSpeed] = useState(1);
  const [panel, setPanel] = useState<Panel>(null),
    [selected, setSelected] = useState<Selection>(null),
    [notice, setNotice] = useState(""),
    [saveStatus, setSaveStatus] = useState("Sauvegarde locale"),
    [focus, setFocus] = useState(
      () => localStorage.getItem("tokenfall-ui") !== "full",
    );
  const [reset, setReset] = useState(false),
    [importMode, setImportMode] = useState("codex"),
    [zoom, setZoom] = useState(1),
    [syncRequest, setSyncRequest] = useState(0);
  const [sync, setSync] = useState<{
    phase: "idle" | "loading" | "connected" | "error";
    lastSuccess: number | null;
    count: number;
    incomplete: number;
    error: string;
  }>({ phase: "idle", lastSuccess: null, count: 0, incomplete: 0, error: "" });
  const dialog = useRef<HTMLDialogElement>(null);
  const running = useRef({ paused, speed }),
    selection = useRef(selected),
    interaction = useRef(0),
    lastStory = useRef(-1),
    drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const w = view;
  const villageAudio = useVillageAudio(w, paused || !ready);
  useLayoutEffect(() => {
    // A place opened from the end of the directory starts at its own heading.
    if (drawer.current) drawer.current.scrollTop = 0;
  }, [panel, selected]);
  useEffect(() => {
    running.current = { paused, speed };
    selection.current = selected;
  }, [paused, speed, selected]);
  const update = () => setView(structuredClone(world.current));
  useEffect(() => {
    if (!ready) return;
    let live = true,
      timer = 0;
    let active: AbortController | undefined;
    const poll = async () => {
      active = new AbortController();
      const controller = active;
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      setSync((previous) => ({ ...previous, phase: "loading", error: "" }));
      try {
        const { events, codexSessions, incomplete } = await readUsageBridge(
          controller.signal,
        );
        if (!live) return;
        const first = localStorage.getItem("tokenfall-bridge-seen") !== "1";
        const changed = syncUsage(world.current, events, first, codexSessions);
        localStorage.setItem("tokenfall-bridge-seen", "1");
        if (changed) update();
        setSync({
          phase: "connected",
          lastSuccess: Date.now(),
          count: events.length,
          incomplete,
          error: "",
        });
      } catch (error) {
        if (live)
          setSync((previous) => ({
            ...previous,
            phase: "error",
            error:
              error instanceof Error
                ? error.message
                : "Synchronisation impossible.",
          }));
      } finally {
        clearTimeout(timeout);
        if (live) timer = window.setTimeout(poll, 15000);
      }
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
      active?.abort();
    };
  }, [ready, syncRequest]);
  const announce = (s: string) => {
    setNotice(s);
    setTimeout(() => setNotice(""), 6500);
  };
  useEffect(() => {
    if (reset && dialog.current) {
      const before = document.activeElement as HTMLElement;
      dialog.current.showModal();
      return () => before?.focus();
    }
  }, [reset]);
  useEffect(() => {
    let live = true;
    loadWorld()
      .then((saved) => {
        if (!live) return;
        if (saved) {
          catchUp(saved);
          world.current = saved;
        } else
          world.current.settings.reducedMotion = matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
        setReady(true);
      })
      .catch(() => {
        if (live) {
          setReady(true);
          setSaveStatus("Sauvegarde inaccessible");
          setNotice(
            "Sauvegarde illisible ou inaccessible. Vous pouvez restaurer un export depuis Données.",
          );
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || !canvas.current) return;
    const r = new WorldRenderer(canvas.current);
    renderer.current = r;
    let frame = 0,
      last = performance.now(),
      acc = 0,
      lastUI = 0,
      lastSave = 0,
      disposed = false;
    const save = () => {
      saveWorld(world.current)
        .then(() => {
          if (!disposed) setSaveStatus("Sauvegardé sur cet appareil");
        })
        .catch(() => {
          if (!disposed)
            setSaveStatus("Échec de sauvegarde — export conseillé");
        });
    };
    const loop = (now: number) => {
      const elapsed = Math.min((now - last) / 1000, 0.5);
      last = now;
      if (!running.current.paused) {
        acc += elapsed * running.current.speed;
        while (acc >= 0.2) {
          r.capturePositions(world.current);
          step(world.current);
          acc -= 0.2;
        }
      }
      const current = world.current,
        event = current.chronicle[0];
      syncDay(current);
      if (
        current.settings.storyCamera &&
        !current.settings.reducedMotion &&
        event?.person !== undefined &&
        event.tick !== lastStory.current &&
        now - interaction.current > 20000
      ) {
        const v = current.villagers[event.person];
        const [x, y] = r.project(v.x, v.y);
        r.pan[0] += (r.width * 0.5 - x) * 0.08;
        r.pan[1] += (r.height * 0.5 - y) * 0.08;
        if (Math.hypot(r.width * 0.5 - x, r.height * 0.5 - y) < 5)
          lastStory.current = event.tick;
      }
      r.interpolation = acc / 0.2;
      r.render(
        current,
        current.tick * 0.2 + acc,
        selection.current?.kind === "person" ? selection.current.id : null,
      );
      if (now - lastUI > 400) {
        setView(structuredClone(world.current));
        lastUI = now;
      }
      if (now - lastSave > 5000) {
        save();
        lastSave = now;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const hidden = () => {
      if (document.hidden) save();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", hidden);
      saveWorld(world.current).catch(() => {});
    };
  }, [ready]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,select,textarea,button"))
        return;
      if (e.key === "Escape") {
        setPanel(null);
        setSelected(null);
        setReset(false);
      }
      if (e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      }
      if (
        renderer.current &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        interaction.current = performance.now();
        renderer.current.pan[0] +=
          e.key === "ArrowLeft" ? 30 : e.key === "ArrowRight" ? -30 : 0;
        renderer.current.pan[1] +=
          e.key === "ArrowUp" ? 30 : e.key === "ArrowDown" ? -30 : 0;
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const population = residents(w).length,
    latest = w.chronicle[0];
  const cue = storyCue(w);
  const landmarks = panel === "chronicle" || focus ? storyLandmarks(w) : [];
  const aid = panel === "chronicle" ? storyAid(w) : null;
  const dailyUsage = dailyFresh(w);
  const todayTokens = dailyUsage.get(w.day) ?? 0;
  const displayedBudget = effectiveBudget(w, dailyUsage);
  const budgetDays = [...dailyUsage.keys()].filter((day) => day < w.day).length;
  const countedCategories =
    [
      w.settings.includeInput ? "entrées hors cache" : null,
      w.settings.includeOutput ? "sorties" : null,
    ]
      .filter(Boolean)
      .join(" + ") || "aucune catégorie activée";
  const usage = selectedUsage(w);
  const todaySource = tokenSourceLabel(
    usage.filter((event) => event.at.slice(0, 10) === w.day),
  );
  const choose = (s: Selection) => {
    interaction.current = performance.now();
    setSelected(s);
    setPanel(null);
  };
  const changeZoom = (z: number) => {
    const v = Math.min(8, Math.max(0.4, z));
    setZoom(v);
    if (renderer.current) renderer.current.zoom = v;
    interaction.current = performance.now();
  };
  const close = (returnFocus = true) => {
    const fromFocus = openedFromFocus.current;
    openedFromFocus.current = false;
    setPanel(null);
    setSelected(null);
    if (fromFocus && returnFocus) {
      requestAnimationFrame(() =>
        (focusStoryButton.current ?? interfaceButton.current)?.focus(),
      );
    }
  };
  const toggle = (p: Panel) => {
    setSelected(null);
    setPanel(panel === p ? null : p);
  };
  const person = selected?.kind === "person" ? w.villagers[selected.id] : null,
    building = selected?.kind === "building" ? w.buildings[selected.id] : null;
  const companion = person && talkingPartner(w, person);
  const firstSpeaker = w.neighbourTalk && w.villagers[w.neighbourTalk.first];
  const secondSpeaker = firstSpeaker && talkingPartner(w, firstSpeaker);
  const rain = building ? rainCollection(w, building) : null;
  const fire = building ? fireAid(w, building) : null;
  const market = building ? marketOffer(w, building) : null;
  const bakery = building ? bakeryState(w, building) : null;
  const importFile = async (file: File) => {
    try {
      if (file.size > 8_000_000)
        throw Error("Fichier trop volumineux : 8 Mo maximum.");
      const text = await file.text();
      if (importMode === "save") {
        const restored = restore(text);
        await saveWorld(restored);
        world.current = restored;
        announce("Le village et ses souvenirs ont été restaurés.");
        update();
        return;
      }
      const events =
        importMode === "codex"
          ? new CodexAdapter().read(text)
          : importMode === "claude"
            ? new ClaudeAdapter().read(text)
            : new ReplayAdapter().read(text);
      const copy = structuredClone(world.current);
      let count = 0;
      if (importMode !== "timed")
        for (const e of events) if (ingest(copy, e)) count++;
      if (importMode === "timed") {
        const validation = structuredClone(world.current);
        for (const event of events) ingest(validation, event);
        events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
        if (!events.length) throw Error("Replay vide.");
        copy.usage = structuredClone(world.current.usage);
        copy.replay = {
          events,
          cursor: 0,
          startedTick: copy.tick,
          firstAt: Date.parse(events[0].at),
        };
        copy.session = events[0].session;
        copy.replayOn = false;
        count = 0;
      }
      if (importMode === "codex" || importMode === "claude") {
        delete copy.replay;
        copy.session = events[events.length - 1].session;
        copy.replayOn = false;
      }
      world.current = copy;
      update();
      announce(
        importMode === "timed"
          ? "Replay daté lancé. Les intervalles d’origine sont conservés."
          : `${count} événement(s) ajouté(s) ou complété(s). Les doublons sont ignorés.`,
      );
    } catch (error) {
      announce(error instanceof Error ? error.message : "Import impossible.");
    }
  };
  return (
    <main className={focus ? "app focus" : "app"}>
      <a className="skip" href="#world-actions">
        Aller aux commandes du village
      </a>
      <canvas
        ref={canvas}
        className="world"
        tabIndex={-1}
        aria-label="Village de Val-des-Saules sur un monde porté par quatre éléphants et une tortue cosmique. Utilisez Habitants et Lieux pour les inspections au clavier."
        onPointerDown={(e) => {
          interaction.current = performance.now();
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !renderer.current) return;
          const dx = e.clientX - d.x,
            dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
          if (d.moved) {
            renderer.current.pan[0] += dx;
            renderer.current.pan[1] += dy;
          }
          d.x = e.clientX;
          d.y = e.clientY;
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) {
            const rect = e.currentTarget.getBoundingClientRect(),
              hit = renderer.current?.hit(
                e.clientX - rect.left,
                e.clientY - rect.top,
              );
            if (hit) choose({ id: hit.id, kind: hit.kind });
            else setSelected(null);
          }
          drag.current = null;
        }}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => changeZoom(zoom * Math.exp(-e.deltaY * 0.002))}
      />
      <header className="topbar">
        <div className="wordmark">
          <span className="brand-symbol" aria-hidden="true">
            ◈
          </span>
          <h1>
            TOKENFALL<span>un petit monde, une longue histoire</span>
          </h1>
        </div>
        <div className="top-meta">
          <span className="live-dot" />
          <span>
            {w.settings.scenario === "persistent"
              ? "Civilisation persistante"
              : w.settings.scenario === "daily"
                ? "Scénario quotidien"
                : "Scénario de session"}
          </span>
          <button
            className="provenance"
            onClick={() => toggle("data")}
            aria-expanded={panel === "data"}
          >
            Synchro & données
            <span className="sync-short-state">
              {sync.phase === "connected"
                ? "Connecté"
                : sync.phase === "error"
                  ? "À vérifier"
                  : sync.phase === "loading"
                    ? "En cours"
                    : "En attente"}
            </span>
          </button>
        </div>
        <button
          className="settings-button"
          onClick={() => toggle("settings")}
          aria-expanded={panel === "settings"}
        >
          Réglages <span aria-hidden="true">⚙</span>
        </button>
      </header>
      <section className="place-title" aria-label="État du village">
        <div className="eyebrow">LA VIE SUIT SON COURS</div>
        <h2>Val-des-Saules</h2>
        <p>
          <span className="sun" aria-hidden="true">
            {daylight(w.tick) < 0.5 ? "☾" : "☼"}
          </span>{" "}
          Jour {Math.floor(w.tick / 288) + 1} <i>·</i>{" "}
          {seasonNames[season(w.tick)]}{" "}
          <small title="Jours restants avant le changement de saison">
            (encore {daysToNextSeason(w.tick)} j)
          </small>{" "}
          <i>·</i> {clock(w.tick)} <i>·</i> {w.weather}
        </p>
        <div className={`stage stage-${stage(w)}`}>
          <span />
          {milestoneNames[stage(w)]}
        </div>
      </section>
      <aside className="world-caption">
        <span>
          01 —{" "}
          {w.pressure > 55
            ? "LA TERRE SE SOUVIENT"
            : "LE TEMPS DES CHOSES SIMPLES"}
        </span>
        <p>
          {w.pressure > 75
            ? "Certaines fenêtres ne s’allument plus."
            : w.pressure > 35
              ? "Au puits, on parle un peu moins de la pluie."
              : "Quelqu’un a encore laissé la porte du jardin ouverte."}
        </p>
      </aside>
      {ready && (
        <a className="demo-nav" href="?demo=village">
          Voir la démo simulée
        </a>
      )}
      <div className="view-tools">
        <button aria-label="Zoom avant" onClick={() => changeZoom(zoom * 1.3)}>
          +
        </button>
        <button
          aria-label="Zoom arrière"
          onClick={() => changeZoom(zoom / 1.3)}
        >
          −
        </button>
        <button
          aria-label="Recentrer le village"
          onClick={() => {
            if (renderer.current) {
              renderer.current.pan = [0, 0];
              changeZoom(1);
            }
          }}
        >
          ⌖
        </button>
        <button
          ref={interfaceButton}
          aria-label={focus ? "Afficher l’interface" : "Masquer l’interface"}
          title={focus ? "Afficher l’interface" : "Masquer l’interface"}
          aria-pressed={!focus}
          onClick={() => {
            localStorage.setItem("tokenfall-ui", focus ? "full" : "focus");
            setFocus(!focus);
          }}
        >
          ▣
        </button>
        {focus && (cue || landmarks.length > 0) && !panel && !selected && (
          <button
            type="button"
            className="focus-story-entry"
            ref={focusStoryButton}
            onClick={() => {
              openedFromFocus.current = true;
              setPanel("chronicle");
              requestAnimationFrame(() => chronicleHeading.current?.focus());
            }}
          >
            <span aria-hidden="true">◈</span>{" "}
            {cue ? "Événement en cours" : "Traces du village"}
          </button>
        )}
      </div>
      <div className="world-hint">
        Glisser pour explorer <span>·</span> Cliquer pour rencontrer
      </div>
      <section
        className="hud"
        aria-label="État des réserves et de la consommation"
      >
        <div className="token-count">
          <span>{todaySource} · aujourd’hui (UTC) · hors cache</span>
          <strong>{fmt(todayTokens)}</strong>
          <div className="token-budget-note">
            Budget du jeu : {fmt(displayedBudget)}
          </div>
        </div>
        <button
          className="pressure-stat pressure-explain"
          onClick={() => toggle("about")}
          aria-expanded={panel === "about"}
          aria-label={`Comprendre l’état du village : pression du jeu ${Math.round(w.pressure)} %`}
        >
          <span>
            PRESSION DU JEU <b>{Math.round(w.pressure)}%</b>
          </span>
          <span className="pressure-track" aria-hidden="true">
            <span style={{ width: `${w.pressure}%` }} />
          </span>
          <small>Comprendre ↗</small>
        </button>
        <div className="resource">
          <span className="resource-icon" aria-hidden="true">
            ♙
          </span>
          <div>
            <strong>
              {population}
              <small> / {villageCapacity}</small>
            </strong>
            <span>habitants</span>
          </div>
        </div>
        <div className="resource">
          <span className="resource-icon water-icon" aria-hidden="true">
            ♧
          </span>
          <div>
            <strong>
              {Math.round(w.water)}
              <small>%</small>
            </strong>
            <span>eau en réserve</span>
          </div>
        </div>
        <div className="resource">
          <span className="resource-icon" aria-hidden="true">
            ♧
          </span>
          <div>
            <strong>
              {Math.round(w.food)}
              <small>%</small>
            </strong>
            <span>garde-manger</span>
          </div>
        </div>
      </section>
      <footer id="world-actions" className="bottom-bar">
        <div className="playback">
          <button
            className="pause"
            aria-label={paused ? "Reprendre la simulation" : "Mettre en pause"}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "▶" : "Ⅱ"}
          </button>
          <div className="speeds" aria-label="Vitesse de simulation">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
        <nav aria-label="Explorer le village">
          <button
            aria-expanded={panel === "residents"}
            onClick={() => toggle("residents")}
          >
            Habitants & lieux
          </button>
          <button
            aria-expanded={panel === "chronicle"}
            onClick={() => toggle("chronicle")}
          >
            Chronique <span className="event-dot" />
          </button>
        </nav>
        <span className="save-status" title={saveStatus}>
          <span />
          {saveStatus.startsWith("Échec")
            ? "Échec de sauvegarde"
            : sync.phase === "connected"
              ? "Suit votre usage · local"
              : "Monde autonome · local"}
        </span>
      </footer>
      {!panel && !selected && (
        <button
          className="chronicle-teaser"
          onClick={() => toggle("chronicle")}
        >
          <span className="eyebrow">LA CHRONIQUE DU VILLAGE</span>
          <span>{latest?.text}</span>
          <b aria-hidden="true">↗</b>
        </button>
      )}
      {(panel || selected) && (
        <aside
          ref={drawer}
          className="drawer"
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !openedFromFocus.current) return;
            event.stopPropagation();
            close();
          }}
          aria-label={
            person
              ? `Histoire de ${person.name}`
              : building
                ? building.name
                : "Panneau du village"
          }
        >
          <div className="drawer-top">
            <span className="eyebrow">
              {person
                ? "UNE VIE PARMI LES AUTRES"
                : building
                  ? "LES LIEUX ONT UNE MÉMOIRE"
                  : panel === "settings"
                    ? "À VOTRE RYTHME"
                    : panel === "chronicle"
                      ? "MÉMOIRE COLLECTIVE"
                      : panel === "data"
                        ? "DES NOMBRES, PAS DES SECRETS"
                        : panel === "about"
                          ? "UNE FICTION VIVANTE"
                          : "FAIRE CONNAISSANCE"}
            </span>
            <button aria-label="Fermer le panneau" onClick={() => close()}>
              ×
            </button>
          </div>
          {person && (
            <>
              <div className="person-heading">
                <span
                  className={`portrait portrait-${youthStage(person.age) ?? residentSkin(person.id)}`}
                  aria-hidden="true"
                />
                <div>
                  <h2>{person.name}</h2>
                  <p>
                    {person.role} ·{" "}
                    {person.age
                      ? `${person.age} ${person.age === 1 ? "an" : "ans"}`
                      : "Nouveau-né"}
                  </p>
                </div>
              </div>
              <p className="current-action">
                <span />
                {person.dead
                  ? remainsLabel(person, w.tick)
                  : companion
                    ? `Discute avec ${companion.name}`
                    : person.action}
              </p>
              {!person.dead && (
                <>
                  <Meter label="Hydratation" value={person.thirst} reverse />
                  <Meter label="Satiété" value={person.hunger} reverse />
                  <Meter label="Énergie" value={person.energy} />
                  <Meter label="Santé" value={person.health} />
                  <Meter label="Moral" value={person.morale} />
                </>
              )}
              {!person.dead && (
                <section className="resident-aid" aria-labelledby="resident-aid-title">
                  <h3 id="resident-aid-title">Aider cet habitant</h3>
                  <p>Chaque geste puise dans les réserves du village.</p>
                  {residentAidOptions(w, person).map((item) => {
                    const hint = `resident-aid-${item.supply}`;
                    return (
                      <div className="resident-aid-option" key={item.supply}>
                        <button
                          type="button"
                          className="primary"
                          aria-disabled={item.reason !== null}
                          aria-describedby={hint}
                          onClick={() => {
                            if (item.reason) return;
                            const current = world.current;
                            const text = giveResidentAid(current, person.id, item.supply);
                            if (text) {
                              note(current, text, "hope", person.id);
                              renderer.current?.aidFeedbacks.show(
                                current, person.id, item.supply, performance.now(),
                              );
                            }
                            announce(text ?? "Cette aide n’est plus disponible.");
                            update();
                          }}
                        >
                          {item.label}
                        </button>
                        <small id={hint}>
                          {item.reason ?? `Coût : ${item.cost} points ${item.supply === "water" ? "d’eau" : "de nourriture"}.`}
                        </small>
                      </div>
                    );
                  })}
                </section>
              )}
              <CauseList
                title="Ce qui explique son état"
                causes={personCauses(w, person)}
              />
              <h3>Les liens qui restent</h3>
              <div className="ties">
                {person.ties.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => choose({ kind: "person", id: t.id })}
                  >
                    <span>{w.villagers[t.id].name}</span>
                    <small>
                      {t.bond > 70
                        ? "Proche"
                        : t.bond > 40
                          ? "Voisin de confiance"
                          : "Relation tendue"}
                      {t.favors > 0 ? " · service à rendre" : ""}
                    </small>
                    <b>↗</b>
                  </button>
                ))}
              </div>
              <h3>Quelques pages de sa vie</h3>
              <ol className="timeline">
                {person.memories.map((m, i) => (
                  <li key={`${m.tick}-${i}`} className={m.kind}>
                    <small>
                      Jour {Math.floor(m.tick / 288) + 1} · {clock(m.tick)}
                    </small>
                    <p>{m.text}</p>
                  </li>
                ))}
              </ol>
            </>
          )}
          {building && (
            <>
              <h2>{building.name}</h2>
              <Meter label="État" value={building.condition} />
              <Meter
                label="Production / réserve"
                value={
                  ["well", "reservoir"].includes(building.type)
                    ? w.water
                    : building.type === "farm"
                      ? w.fertility
                      : w.food
                }
              />
              {fire && (
                <section className="story-aid" aria-labelledby="fire-aid-title">
                  <h3 id="fire-aid-title">Incendie en cours</h3>
                  <p id="fire-aid-details">
                    {fire.unavailable ?? `−${fire.waterCost} points d’eau pour affaiblir les flammes, une fois par incendie.`}
                  </p>
                  <button
                    type="button"
                    className="primary"
                    aria-describedby="fire-aid-details"
                    aria-disabled={fire.unavailable !== null}
                    onClick={() => {
                      if (fire.unavailable) return;
                      const current = world.current;
                      const text = supportFireCrew(current, building.id);
                      update();
                      if (text) {
                        saveWorld(current).catch(() => {
                          setSaveStatus("Échec de sauvegarde — export conseillé");
                        });
                      }
                      announce(text ?? "Ce renfort n’est plus disponible.");
                    }}
                  >
                    {fire.fire.waterAidTicks ? "Renfort envoyé" : "Envoyer de l’eau"}
                  </button>
                </section>
              )}
              {rain && (
                <section className="story-aid" aria-labelledby="rain-collection-title">
                  <h3 id="rain-collection-title">Les seaux de pluie</h3>
                  <p id="rain-collection-details">
                    {rain.unavailable ?? `+${rain.amount} points d’eau dans la réserve, une fois par averse.`}
                  </p>
                  <button
                    type="button"
                    className="primary"
                    aria-describedby="rain-collection-details"
                    aria-disabled={rain.unavailable !== null}
                    onClick={() => {
                      if (rain.unavailable) return;
                      const current = world.current;
                      const text = harvestRainwater(current, building.id);
                      update();
                      if (text) {
                        saveWorld(current).catch(() => {
                          setSaveStatus("Échec de sauvegarde — export conseillé");
                        });
                      }
                      announce(text ?? "Les seaux ne peuvent plus être vidés.");
                    }}
                  >
                    {rain.collected && rain.visible ? "Seaux vidés" : "Vider les seaux dans la réserve"}
                  </button>
                </section>
              )}
              {bakery && (
                <section className="story-aid" aria-labelledby="bakery-title">
                  <h3 id="bakery-title">La fournée quotidienne</h3>
                  <p>
                    {bakery.fresh
                      ? "Le pain vient de sortir du four. Les miches sont devant la boulangerie."
                      : bakery.message ?? "Une fournée rejoint les réserves lorsqu’un adulte vient pétrir ici."}
                  </p>
                  {bakery.fresh && building && (
                    <button className="text-link" onClick={() => {
                      const r = renderer.current;
                      if (!r) return;
                      interaction.current = performance.now();
                      changeZoom(Math.max(r.zoom, 2.4));
                      const [x, y] = r.project(...breadDisplayPosition(building));
                      r.pan[0] += r.width * 0.36 - x;
                      r.pan[1] += r.height * 0.42 - y;
                    }}>
                      Voir les miches ↗
                    </button>
                  )}
                </section>
              )}
              {market && (
                <section className="story-aid" aria-labelledby="market-title">
                  <h3 id="market-title">L’étal de troc</h3>
                  <p id="market-details">
                    {market.unavailable ?? `Offre du jour : ${market.terms}. Un seul troc par jour.`}
                  </p>
                  <button
                    type="button"
                    className="primary"
                    aria-describedby="market-details"
                    aria-disabled={market.unavailable !== null}
                    onClick={() => {
                      if (market.unavailable) return;
                      const current = world.current;
                      const text = tradeAtMarket(current, building.id);
                      update();
                      if (text) {
                        saveWorld(current).catch(() => {
                          setSaveStatus("Échec de sauvegarde — export conseillé");
                        });
                      }
                      announce(text ?? "Ce troc n’est plus disponible.");
                    }}
                  >
                    {!market.open
                      ? "Étal fermé"
                      : market.sold
                        ? "Troc effectué"
                        : "Faire le troc"}
                  </button>
                </section>
              )}
              <CauseList
                title="Ce qui agit sur ce lieu"
                causes={buildingCauses(w, building)}
              />
              <h3>
                {building.type === "home" ? "Ceux qui y vivent" : "À proximité"}
              </h3>
              {w.villagers
                .filter((v) =>
                  building.type === "home"
                    ? v.home === building.id
                    : Math.hypot(v.x - building.x, v.y - building.y) < 5,
                )
                .map((v) => (
                  <button
                    className="resident-row"
                    key={v.id}
                    onClick={() => choose({ kind: "person", id: v.id })}
                  >
                    <span>{v.name}</span>
                    <small>{v.dead ? remainsLabel(v, w.tick) : v.role}</small>
                    <b>↗</b>
                  </button>
                ))}
              <h3>À cet endroit</h3>
              {building.events.length ? (
                building.events.map((e, i) => <p key={i}>{e.text}</p>)
              ) : (
                <p className="muted">
                  Les jours ordinaires ont aussi leur importance.
                </p>
              )}
            </>
          )}
          {panel === "residents" && (
            <>
              <h2>Les gens d’ici</h2>
              <p className="muted">
                {population} habitants en vie ·{" "}
                {w.villagers.length - population} défunts. Leurs histoires
                restent ici.
              </p>
              {w.villagers.map((v) => (
                <button
                  key={v.id}
                  className="resident-row"
                  onClick={() => choose({ kind: "person", id: v.id })}
                >
                  <span className={`person-dot color-${v.id % 4}`} />
                  <span>
                    {v.name}
                    <small>{v.role}</small>
                  </span>
                  <small>
                    {v.dead ? "Décédé · souvenir ↗" : "Rencontrer ↗"}
                  </small>
                </button>
              ))}
              <h3>Les lieux du village</h3>
              {w.buildings.map((b) => (
                <button
                  key={b.id}
                  className="resident-row"
                  onClick={() => choose({ kind: "building", id: b.id })}
                >
                  <span>{b.name}</span>
                  <b>↗</b>
                </button>
              ))}
            </>
          )}
          {panel === "chronicle" && (
            <>
              <h2 ref={chronicleHeading} tabIndex={-1}>La chronique</h2>
              {firstSpeaker && secondSpeaker && (
                <p>
                  En ce moment : {firstSpeaker.name} et {secondSpeaker.name} font une pause pour discuter.{" "}
                  <button
                    className="text-link"
                    onClick={() => {
                      const r = renderer.current;
                      if (r) {
                        changeZoom(Math.max(r.zoom, 2.4));
                        const [x, y] = r.project(
                          (firstSpeaker.x + secondSpeaker.x) / 2,
                          (firstSpeaker.y + secondSpeaker.y) / 2,
                        );
                        r.pan[0] += r.width * 0.36 - x;
                        r.pan[1] += r.height * 0.42 - y;
                      }
                      choose({ kind: "person", id: firstSpeaker.id });
                    }}
                  >
                    Voir {firstSpeaker.name} ↗
                  </button>
                </p>
              )}
              <p className="muted">Les petites choses qui changent tout.</p>
              {cue && (
                <button
                  className="text-link"
                  onClick={() => {
                    const r = renderer.current;
                    if (!r) return;
                    const [x, y] = r.project(cue.x, cue.y);
                    interaction.current = performance.now();
                    r.pan[0] += r.width * 0.36 - x;
                    r.pan[1] += r.height * 0.29 - y;
                    close(false);
                    requestAnimationFrame(() => canvas.current?.focus());
                  }}
                >
                  Voir l’événement en cours · {cue.label} ↗
                </button>
              )}
              {aid && (
                <section className="story-aid" aria-labelledby="story-aid-heading">
                  <h3 id="story-aid-heading">Donner un coup de main</h3>
                  <p id="story-aid-details">
                    {aid.contributed
                      ? "Le village a reçu votre aide. La suite dépend encore de ses réserves et de son entraide."
                      : `Réserves : −${aid.cost} ${aid.resource === "water" ? "d’eau" : "de nourriture"}. Entraide : +${aid.benefit} (sur 100).`}
                  </p>
                  <button
                    type="button"
                    className="primary"
                    aria-describedby="story-aid-details"
                    aria-disabled={aid.contributed || !aid.affordable}
                    onClick={() => {
                      if (aid.contributed || !aid.affordable) return;
                      const current = world.current;
                      const applied = contributeToStory(current, aid.id, (text, kind, resident) =>
                        note(current, text, kind, resident),
                      );
                      update();
                      announce(applied ? aid.text : "Cette aide n’est plus disponible.");
                    }}
                  >
                    {aid.contributed
                      ? "Aide apportée"
                      : aid.affordable ? aid.label : "Réserves insuffisantes"}
                  </button>
                </section>
              )}
              {landmarks.length > 0 && (
                <section className="story-landmarks" aria-labelledby="landmarks-title">
                  <h3 id="landmarks-title">Traces du village</h3>
                  <ul>
                    {landmarks.map(({ id, x, y, name, label }) => (
                      <li key={id}>
                        <button
                          type="button"
                          className="resident-row"
                          onClick={() => {
                            const r = renderer.current;
                            if (!r) return;
                            changeZoom(Math.max(zoom, 3));
                            r.locateLandmark(x, y, interaction.current);
                            close(false);
                            announce(`${name} · ${label}`);
                            requestAnimationFrame(() => canvas.current?.focus());
                          }}
                        >
                          <span>
                            {name}
                            <small>{id === "lanterns" ? bridgeLight(w)?.label ?? label : label}</small>
                          </span>
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                            <circle cx="8" cy="8" r="5" />
                            <path d="M8 1v4m0 6v4M1 8h4m6 0h4" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <ol className="timeline">
                {w.chronicle.map((e, i) => (
                  <li key={`${e.tick}-${i}`} className={e.kind}>
                    <small>
                      Jour {Math.floor(e.tick / 288) + 1} · {clock(e.tick)}
                    </small>
                    <p>{e.text}</p>
                    {e.person !== undefined && (
                      <button
                        className="text-link"
                        onClick={() =>
                          choose({ kind: "person", id: e.person! })
                        }
                      >
                        Rencontrer {w.villagers[e.person].name} ↗
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
          {panel === "about" && (
            <>
              <h2>Comprendre le village</h2>
              <CauseList
                title="Ce qui se passe maintenant"
                causes={villageCauses(w)}
              />
              <p>
                Le jeu utilise les tokens de la source sélectionnée pour calculer la pression du village.
                Le budget et les seuils se règlent dans les paramètres.
              </p>
              <blockquote>
                La pression, la sécheresse et les incendies sont simulés dans le jeu.
              </blockquote>
              <h3>De l’usage aux histoires</h3>
              <p>
                La pression assèche progressivement les sols. Les cultures
                produisent moins ; les réserves diminuent. Chaque habitant
                réagit à sa soif, sa faim et ses relations. Certains partagent,
                d’autres se disputent. Lorsque leur santé s’épuise, ils meurent
                sur place ; leurs corps deviennent peu à peu des squelettes.
              </p>
              <h3>Il reste des choses à faire</h3>
              <p>
                Après 20 secondes de simulation sans nouvel usage, la pression
                commence à se relâcher. L’entraide accélère cette récupération
                fictive. Les défunts et leurs restes restent dans la mémoire et
                sur le sol du village.
              </p>
              <button
                className="primary"
                onClick={() => {
                  intervene(world.current);
                  update();
                  announce(
                    "Une journée d’entraide commence. Récupération fictive, sans compensation écologique.",
                  );
                }}
              >
                Organiser l’entraide
              </button>
              <p className="fine-print">
                Simulation déterministe · aucun appel d’IA · aucun contenu de
                conversation collecté.
              </p>
            </>
          )}
          {panel === "settings" && (
            <>
              <h2>Prendre le temps.</h2>
              <VillageAudioSettings {...villageAudio} />
              <label className="field">
                Scénario
                <select
                  value={w.settings.scenario}
                  onChange={(e) => {
                    setScenario(world.current, e.target.value as Scenario);
                    update();
                  }}
                >
                  <option value="persistent">Civilisation persistante</option>
                  <option value="daily">Chaque jour (UTC)</option>
                  <option value="session">Chaque session</option>
                </select>
              </label>
              <p className="fine-print">
                Changer de scénario conserve le village. « Nouvelle session »
                crée un village neuf uniquement en mode session.
              </p>
              <label className="field">
                Budget fictif de tokens
                <input
                  type="number"
                  min="1000"
                  max="1000000000"
                  step="1000"
                  value={w.settings.budget}
                  onChange={(e) => {
                    world.current.settings.budget = Math.min(
                      1e9,
                      Math.max(1000, Number(e.target.value) || 1000),
                    );
                    update();
                  }}
                />
              </label>
              <label className="field">
                Courbe de pression : {w.settings.curve.toFixed(1)}
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={w.settings.curve}
                  onChange={(e) => {
                    world.current.settings.curve = +e.target.value;
                    update();
                  }}
                />
              </label>
              <details>
                <summary>Seuils narratifs & catégories</summary>
                <p className="fine-print">
                  Repères fictifs, ajustables et croissants.
                </p>
                {w.settings.thresholds.map((t, i) => (
                  <label className="threshold" key={i}>
                    {milestoneNames[i + 1]}
                    <input
                      aria-label={`Seuil ${milestoneNames[i + 1]}`}
                      type="number"
                      min={i ? w.settings.thresholds[i - 1] + 1 : 1}
                      max={i < 4 ? w.settings.thresholds[i + 1] - 1 : 99}
                      value={t}
                      onChange={(e) => {
                        world.current.settings.thresholds[i] = Math.min(
                          i < 4 ? w.settings.thresholds[i + 1] - 1 : 99,
                          Math.max(
                            i ? w.settings.thresholds[i - 1] + 1 : 1,
                            +e.target.value,
                          ),
                        );
                        update();
                      }}
                    />
                    %
                  </label>
                ))}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={w.settings.includeInput}
                    onChange={(e) => {
                      world.current.settings.includeInput = e.target.checked;
                      update();
                    }}
                  />{" "}
                  Compter les tokens d’entrée
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={w.settings.includeOutput}
                    onChange={(e) => {
                      world.current.settings.includeOutput = e.target.checked;
                      update();
                    }}
                  />{" "}
                  Compter les tokens de sortie
                </label>
                <p className="fine-print">
                  Cache et raisonnement sont des sous-catégories, jamais
                  ajoutées au total. Le modèle n’étant pas fourni par tous les
                  flux, aucun filtre de modèle n’est inventé.
                </p>
              </details>
              <label className="check">
                <input
                  type="checkbox"
                  checked={w.settings.reducedMotion}
                  onChange={(e) => {
                    world.current.settings.reducedMotion = e.target.checked;
                    update();
                  }}
                />{" "}
                Réduire les animations
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={w.settings.storyCamera}
                  onChange={(e) => {
                    world.current.settings.storyCamera = e.target.checked;
                    update();
                  }}
                />{" "}
                Caméra narrative discrète
              </label>
              <label className="field">
                Fréquence des rencontres
                <input
                  type="range"
                  min="0.25"
                  max="2"
                  step="0.25"
                  value={w.settings.eventFrequency}
                  onChange={(e) => {
                    world.current.settings.eventFrequency = +e.target.value;
                    update();
                  }}
                />
              </label>
              <button
                className="full-button"
                onClick={() => {
                  newSession(world.current);
                  note(
                    world.current,
                    "Une nouvelle session commence.",
                    "ordinary",
                  );
                  update();
                  announce(
                    "Nouvelle session. Le précédent instantané est conservé.",
                  );
                }}
              >
                Nouvelle session <span>↗</span>
              </button>
              <button className="full-button" onClick={() => toggle("data")}>
                Données & sauvegardes <span>↗</span>
              </button>
              <button className="danger-link" onClick={() => setReset(true)}>
                Recommencer mon village…
              </button>
              <p className="fine-print">
                {w.snapshots.length} instantané(s) de session conservé(s).{" "}
                {saveStatus}.
              </p>
            </>
          )}
          {panel === "data" && (
            <>
              <h2>Synchronisation & données</h2>
              <p>
                Suivez votre consommation Codex et Claude Code avec le pont
                local, ou importez un fichier de métadonnées.
              </p>
              <section
                className="sync-panel"
                aria-label="État de la synchronisation"
              >
                <div className="sync-heading">
                  <strong role="status">
                    {sync.phase === "loading"
                      ? "Synchronisation en cours…"
                      : sync.phase === "connected"
                        ? "Pont local connecté"
                        : sync.phase === "error"
                          ? "Synchronisation interrompue"
                          : "En attente du village"}
                  </strong>
                  <button
                    className="full-button"
                    disabled={!ready || sync.phase === "loading"}
                    onClick={() => setSyncRequest((value) => value + 1)}
                  >
                    {sync.phase === "loading" ? "Actualisation…" : "Actualiser"}
                  </button>
                </div>
                <p className="fine-print">
                  Dernière réussite :{" "}
                  {sync.lastSuccess
                    ? new Date(sync.lastSuccess).toLocaleString("fr-FR")
                    : "pas encore de synchronisation réussie"}
                  .
                </p>
                {sync.lastSuccess !== null && (
                  <p className="fine-print">
                    {sync.count} relevés reçus au dernier succès, avant vos
                    filtres.
                  </p>
                )}
                {sync.phase === "error" && (
                  <div role="alert">
                    <p>
                      {sync.error} Les données déjà importées restent
                      conservées.
                    </p>
                    <p className="fine-print">
                      Depuis le dossier du projet, démarrez le pont :
                    </p>
                    <code>node scripts/usage-server.mjs</code>
                  </div>
                )}
                {sync.incomplete > 0 && (
                  <p className="hint">
                    {sync.incomplete} historique(s) Codex incomplet(s) : les
                    dates manquantes ne sont pas inventées.
                  </p>
                )}
                <p className="fine-print">
                  Nouvelle vérification automatique 15 secondes après chaque
                  tentative. L’import manuel reste disponible plus bas.
                </p>
              </section>
              <h3>Activité qui influence le village</h3>
              <label>
                Projet
                <select
                  value={w.settings.usageProject ?? ""}
                  onChange={(e) => {
                    world.current.settings.usageProject =
                      e.target.value || undefined;
                    world.current.settings.usageSession = undefined;
                    world.current.budgetNow = effectiveBudget(world.current);
                    update();
                  }}
                >
                  <option value="">Tous les projets</option>
                  {[
                    ...new Set(w.usage.map((e) => e.project || "__unknown__")),
                    ...(w.settings.usageProject
                      ? [w.settings.usageProject]
                      : []),
                  ]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort()
                    .map((project) => (
                      <option key={project} value={project}>
                        {project === "__unknown__"
                          ? "Projet non renseigné"
                          : project}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Conversation
                <select
                  value={w.settings.usageSession ?? ""}
                  onChange={(e) => {
                    world.current.settings.usageSession =
                      e.target.value || undefined;
                    world.current.budgetNow = effectiveBudget(world.current);
                    update();
                  }}
                >
                  <option value="">Toutes les conversations</option>
                  {[
                    ...new Map(
                      w.usage
                        .filter(
                          (e) =>
                            !w.settings.usageProject ||
                            (e.project || "__unknown__") ===
                              w.settings.usageProject,
                        )
                        .map((e) => [usageSessionKey(e), e]),
                    ).entries(),
                  ].map(([key, e]) => (
                    <option key={key} value={key}>
                      {e.origin} · {e.session}
                    </option>
                  ))}
                </select>
              </label>
              <p className="fine-print">
                Ce choix filtre les compteurs et la pression du village. Les
                autres données restent conservées. Les titres de conversations
                ne sont pas lus.
              </p>
              {selectedUsage(w).length === 0 && (
                <p className="hint">
                  Aucune consommation enregistrée pour cette sélection.
                </p>
              )}
              <h3>Aujourd’hui · {w.day} · UTC</h3>
              <div
                className="accounting"
                aria-label="Consommation du jour et budget fictif"
              >
                <div>
                  <span>Tokens du jour retenus</span>
                  <b>{fmt(todayTokens)}</b>
                </div>
                <div>
                  <span>
                    Budget fictif {isAdaptive(w) ? "adaptatif" : "fixe"}
                  </span>
                  <b>{fmt(displayedBudget)}</b>
                </div>
              </div>
              <p className="fine-print">
                Calcul : {countedCategories}. La journée change à minuit UTC. Le
                cache connu est retiré des entrées ; le raisonnement est déjà
                inclus dans les sorties.
              </p>
              <p className="hint">
                {isAdaptive(w) && budgetDays > 0
                  ? `Budget : deux fois la moyenne des ${Math.min(ADAPTIVE_DAYS, budgetDays)} derniers jours renseignés avant aujourd’hui, minimum ${fmt(adaptiveFloor)} tokens.`
                  : isAdaptive(w)
                    ? "Pas encore de journée passée renseignée : le budget fixe des réglages sert de référence."
                    : "Le budget fixe est défini dans les réglages du village."}{" "}
                Ce budget pilote le jeu ; il ne correspond ni à votre quota
                Codex ni à une facture.
              </p>
              {!isAdaptive(w) && (
                <p className="fine-print">
                  Pour la pression, le scénario fixe utilise{" "}
                  {w.settings.scenario === "daily"
                    ? "la journée UTC"
                    : w.settings.scenario === "session"
                      ? "la session sélectionnée ou la session du village"
                      : "tout l’historique sélectionné"}
                  . Le compteur principal affiche toujours aujourd’hui.
                </p>
              )}
              <h3>Historique importé · cache compris</h3>
              <p className="fine-print">
                Somme des entrées et sorties conservées pour la sélection,
                toutes dates confondues. Ce total brut peut être beaucoup plus
                élevé que le compteur du jour.
              </p>
              <div className="source-badge">{tokenSourceLabel(usage)}</div>
              <div className="accounting">
                {(["demo", "measured", "estimated"] as const).map((p) => (
                  <div key={p}>
                    <span>
                      {p === "demo"
                        ? "Tokens simulés"
                        : p === "measured"
                          ? "Tokens mesurés et importés"
                          : "Tokens estimés"}
                    </span>
                    <b>
                      {fmt(
                        selectedUsage(w)
                          .filter((e) => e.provenance === p)
                          .reduce((s, e) => s + e.input + e.output, 0),
                      )}
                    </b>
                  </div>
                ))}
              </div>

              <a href="?demo=village">Voir la démo simulée</a>
              <h3>Détail de l’historique sélectionné</h3>
              <div
                className="accounting"
                aria-label="Détail des tokens conservés"
              >
                {(
                  [
                    ["input", "Entrée"],
                    ["output", "Sortie"],
                    ["cached", "Cache (inclus dans l’entrée)"],
                    ["reasoning", "Raisonnement (inclus dans la sortie)"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <span>{label}</span>
                    <b>
                      {(key === "cached" || key === "reasoning") &&
                      !selectedUsage(w).some((e) => e[key] !== undefined)
                        ? "Non fourni"
                        : `${fmt(totals(w)[key])}${(key === "cached" || key === "reasoning") && selectedUsage(w).some((e) => e[key] === undefined) ? " (partiel)" : ""}`}
                    </b>
                  </div>
                ))}
              </div>
              <h3>Importer des métadonnées</h3>
              <label className="field">
                Format
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value)}
                >
                  <option value="codex">Codex exec — flux JSONL complet</option>
                  <option value="claude">
                    Claude Code / ADE — transcript JSONL
                  </option>
                  <option value="replay">Événements normalisés — JSON</option>
                  <option value="timed">
                    Rejouer des événements datés — JSON
                  </option>
                  <option value="save">Sauvegarde complète — JSON</option>
                </select>
              </label>
              <label className="file-input">
                Choisir un fichier
                <input
                  type="file"
                  accept=".json,.jsonl"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="fine-print">
                Les lignes Codex sont filtrées en mémoire : seuls les compteurs
                sont conservés. Sans date, l’usage est classé « date inconnue »
                et ne compte pas pour aujourd’hui. Importez une capture
                complète, sans concaténer des reprises.
              </p>
              <button
                className="full-button"
                onClick={() => {
                  try {
                    ingest(
                      world.current,
                      new DemoAdapter().event(world.current, 10000),
                    );
                    update();
                    announce("10 000 tokens simulés ajoutés.");
                  } catch (error) {
                    announce(
                      error instanceof Error
                        ? error.message
                        : "Impossible d’ajouter cet usage.",
                    );
                  }
                }}
              >
                Ajouter 10 000 tokens simulés <span>+</span>
              </button>
              <button
                className="full-button"
                onClick={() =>
                  download(
                    "tokenfall-save.json",
                    JSON.stringify(
                      { ...world.current, savedAt: Date.now() },
                      null,
                      2,
                    ),
                  )
                }
              >
                Exporter le village & ses histoires <span>↓</span>
              </button>
              <button
                className="full-button"
                onClick={() =>
                  download(
                    "tokenfall-usage.json",
                    JSON.stringify(world.current.usage, null, 2),
                  )
                }
              >
                Exporter les métadonnées <span>↓</span>
              </button>
              <LocalDiagnostics
                world={w}
                saveStatus={saveStatus}
                syncError={sync.error}
              />
              <h3>Confidentialité & conservation</h3>
              <p className="fine-print">
                Tout reste dans IndexedDB sur cet appareil. Aucun serveur,
                aucune clé, aucun prompt conservé. Limites : 20 000 événements,
                160 entrées de chronique, 24 souvenirs par habitant.
              </p>
              <label className="field">
                Ancienneté des métadonnées à retirer
                <select
                  value={w.settings.retentionDays}
                  onChange={(e) => {
                    world.current.settings.retentionDays = +e.target.value;
                    update();
                  }}
                >
                  <option value="7">7 jours</option>
                  <option value="30">30 jours</option>
                  <option value="90">90 jours</option>
                </select>
              </label>
              <button
                className="full-button"
                onClick={() => {
                  const cutoff =
                      Date.now() - w.settings.retentionDays * 86400000,
                    n = w.usage.length;
                  world.current.usage = world.current.usage.filter(
                    (e) => Date.parse(e.at) >= cutoff,
                  );
                  update();
                  announce(
                    `${n - w.usage.length} métadonnée(s) retirée(s). Totaux et pression recalculés.`,
                  );
                }}
              >
                Retirer les anciennes métadonnées
              </button>
              <p className="fine-print">
                Suppression explicite pour conserver les clés de déduplication.
                Un ancien import après suppression sera compté à nouveau.
              </p>
            </>
          )}
        </aside>
      )}
      {reset && (
        <dialog
          ref={dialog}
          onCancel={() => setReset(false)}
          aria-labelledby="reset-title"
          className="confirm"
        >
          <h2 id="reset-title">Recommencer au jour 1 ?</h2>
          <p>
            Votre sauvegarde sera remplacée par un village de 24 habitants au jour 1.
            Si le pont local est connecté, vos relevés de tokens seront de nouveau importés.
          </p>
          <button
            className="full-button"
            onClick={() =>
              download(
                "tokenfall-souvenirs.json",
                JSON.stringify({ ...world.current, savedAt: Date.now() }),
              )
            }
          >
            Exporter mon village actuel ↓
          </button>
          <div>
            <button autoFocus onClick={() => setReset(false)}>
              Garder ce village
            </button>
            <button
              className="destructive"
              onClick={() => {
                world.current = createWorld();
                setReset(false);
                close();
                saveWorld(world.current).catch(() => {
                  setSaveStatus("Échec de sauvegarde — export conseillé");
                });
                announce("Une nouvelle matinée. Une nouvelle histoire.");
                update();
              }}
            >
              Recommencer
            </button>
          </div>
        </dialog>
      )}
      {!ready && (
        <div className="loading" role="status">
          Le village s’éveille…
        </div>
      )}
      <div className={`toast ${notice ? "visible" : ""}`} role="status">
        {notice}
      </div>
    </main>
  );
}
export default App;
