import type { UsageEvent, World } from "./types";

const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 1e12;
export function validateEvent(v: unknown): UsageEvent {
  if (!v || typeof v !== "object") throw Error("Événement invalide.");
  const e = v as UsageEvent;
  if (
    ![e.id, e.session, e.origin].every(
      (s) => typeof s === "string" && s.length > 0 && s.length < 200,
    ) ||
    !["demo", "measured", "estimated"].includes(e.provenance) ||
    !Number.isFinite(Date.parse(e.at)) ||
    !count(e.input) ||
    !count(e.output) ||
    (e.cached !== undefined && (!count(e.cached) || e.cached > e.input)) ||
    (e.reasoning !== undefined &&
      (!count(e.reasoning) || e.reasoning > e.output))
  )
    throw Error("Métadonnées ou compteurs invalides.");
  // Whitelist: never persist arbitrary prompt or command content.
  return {
    id: e.id,
    session: e.session,
    origin: e.origin,
    at: new Date(e.at).toISOString(),
    provenance: e.provenance,
    input: e.input,
    output: e.output,
    ...(e.cached === undefined ? {} : { cached: e.cached }),
    ...(e.reasoning === undefined ? {} : { reasoning: e.reasoning }),
  };
}
/** Tokens that cost real effort: fresh input (cache excluded) plus output. */
export const freshTokens = (
  e: Pick<UsageEvent, "input" | "output" | "cached">,
  s: { includeInput: boolean; includeOutput: boolean },
) =>
  (s.includeInput ? Math.max(0, e.input - (e.cached ?? 0)) : 0) +
  (s.includeOutput ? e.output : 0);

export const ADAPTIVE_DAYS = 7;
export const adaptiveFloor = 10000;
export const isAdaptive = (w: World) => w.settings.adaptive !== false;
/** Fresh tokens used on each UTC day. */
export function dailyFresh(w: World) {
  const days = new Map<string, number>();
  for (const e of w.usage) {
    const d = e.at.slice(0, 10);
    days.set(d, (days.get(d) ?? 0) + freshTokens(e, w.settings));
  }
  return days;
}
/**
 * Adaptive budget: twice the mean daily usage of the last days before today,
 * so an ordinary day sits near half pressure. Falls back to the fixed budget
 * until one full past day is known.
 */
export function effectiveBudget(w: World, daily = dailyFresh(w)) {
  if (!isAdaptive(w)) return w.settings.budget;
  const past = [...daily]
    .filter(([d]) => d < w.day)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, ADAPTIVE_DAYS)
    .map(([, n]) => n);
  if (!past.length) return w.settings.budget;
  const mean = past.reduce((a, b) => a + b, 0) / past.length;
  return Math.max(adaptiveFloor, Math.round(mean * 2));
}
export function ingest(w: World, event: UsageEvent) {
  const e = validateEvent(event);
  const previous = w.usage.find((v) => v.id === e.id && v.origin === e.origin);
  if (previous) {
    // A partial record may be completed later; immutable identity and provenance.
    if (
      previous.session !== e.session ||
      previous.at !== e.at ||
      previous.provenance !== e.provenance
    )
      throw Error("Identité d’événement contradictoire.");
    const delta =
      Math.max(0, e.input - previous.input) +
      Math.max(0, e.output - previous.output);
    const changed = delta > 0;
    const before = freshTokens(previous, w.settings);
    previous.input = Math.max(previous.input, e.input);
    previous.output = Math.max(previous.output, e.output);
    if (e.cached !== undefined)
      previous.cached = Math.max(previous.cached ?? 0, e.cached);
    if (e.reasoning !== undefined)
      previous.reasoning = Math.max(previous.reasoning ?? 0, e.reasoning);
    if (changed) {
      w.lastUsageTick = w.tick;
      const fresh = Math.max(0, freshTokens(previous, w.settings) - before);
      w.relief = Math.max(
        0,
        w.relief - (fresh / (w.budgetNow ?? w.settings.budget)) * 100,
      );
    }
    return changed;
  }
  if (w.usage.length >= 20000)
    throw Error(
      "Limite de 20 000 événements atteinte. Exportez votre sauvegarde.",
    );
  w.usage.push(e);
  w.lastUsageTick = w.tick;
  w.relief = Math.max(
    0,
    w.relief -
      (freshTokens(e, w.settings) / (w.budgetNow ?? w.settings.budget)) * 100,
  );
  return true;
}
export function totals(
  w: World,
  window: "session" | "day" | "lifetime" = "lifetime",
) {
  const events = w.usage.filter(
    (e) =>
      window === "lifetime" ||
      (window === "session"
        ? e.session === w.session
        : e.at.slice(0, 10) === w.day),
  );
  return events.reduce(
    (a, e) => ({
      input: a.input + e.input,
      output: a.output + e.output,
      cached: a.cached + (e.cached ?? 0),
      reasoning: a.reasoning + (e.reasoning ?? 0),
    }),
    { input: 0, output: 0, cached: 0, reasoning: 0 },
  );
}
export interface Adapter {
  read(text: string): UsageEvent[];
}
export class DemoAdapter {
  event(w: World, tokens = 4000): UsageEvent {
    return {
      id: `demo-${w.session}-${w.tick}-${w.usage.length}`,
      session: w.session,
      at: `${w.day}T12:00:00.000Z`,
      origin: "demo",
      provenance: "demo",
      input: Math.round(tokens * 0.7),
      output: Math.round(tokens * 0.3),
    };
  }
}
export class ReplayAdapter implements Adapter {
  read(text: string) {
    const rows: unknown = JSON.parse(text);
    if (!Array.isArray(rows) || rows.length > 20000)
      throw Error("Attendu : une liste de 20 000 événements maximum.");
    return rows.map(validateEvent);
  }
}
export class CodexAdapter implements Adapter {
  read(text: string) {
    let session = "";
    let turn = 0;
    const events: UsageEvent[] = [];
    for (const line of text.split("\n").filter(Boolean)) {
      const e = JSON.parse(line);
      if (e.type === "thread.started" && typeof e.thread_id === "string")
        session = e.thread_id;
      if (e.type === "turn.completed") {
        if (!session)
          throw Error(
            "thread.started doit précéder les usages. Importez le flux JSONL complet.",
          );
        const u = e.usage;
        if (!u) continue;
        // Thread + ordinal is stable when the same complete capture is imported again.
        events.push(
          validateEvent({
            id: `${session}:turn:${turn++}`,
            session,
            at: e.timestamp ?? "1970-01-01T00:00:00.000Z",
            origin: "codex-exec",
            provenance: "measured",
            input: u.input_tokens,
            output: u.output_tokens,
            cached: u.cached_input_tokens,
            reasoning: u.reasoning_output_tokens,
          }),
        );
      }
    }
    if (!events.length) throw Error("Aucun turn.completed avec usage trouvé.");
    return events;
  }
}
/**
 * Claude Code transcripts (~/.claude/projects/<projet>/<session>.jsonl).
 * Only message id, session, timestamp and token counters are read; the
 * conversation content is never inspected or kept. A message streamed over
 * several rows keeps the largest counters; cache reads and writes count as input.
 */
export class ClaudeAdapter implements Adapter {
  read(text: string) {
    const byId = new Map<string, UsageEvent>();
    for (const line of text.split("\n").filter(Boolean)) {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue; // a transcript may end with a half-written line
      }
      const m = row?.message,
        u = m?.usage;
      if (row?.type !== "assistant" || !u || typeof m.id !== "string") continue;
      const cached = u.cache_read_input_tokens ?? 0,
        input =
          (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + cached,
        output = u.output_tokens ?? 0,
        thinking = u.output_tokens_details?.thinking_tokens;
      const e = validateEvent({
        id: m.id,
        session: row.sessionId ?? "claude",
        at: row.timestamp ?? "1970-01-01T00:00:00.000Z",
        origin: "claude-code",
        provenance: "measured",
        input,
        output,
        cached,
        ...(count(thinking) && thinking <= output
          ? { reasoning: thinking }
          : {}),
      });
      const old = byId.get(e.id);
      if (!old || e.input + e.output >= old.input + old.output)
        byId.set(e.id, e);
    }
    if (!byId.size) throw Error("Aucun message assistant avec usage trouvé.");
    return [...byId.values()];
  }
}
/**
 * Apply a batch coming from the local usage bridge. `baseline` records the
 * history already on disk (totals, provenance) without draining the village:
 * only usage that happens afterwards counts as pressure.
 */
export function syncUsage(w: World, events: UsageEvent[], baseline: boolean) {
  const { relief, lastUsageTick } = w;
  let changed = 0;
  for (const e of events) {
    try {
      if (ingest(w, e)) changed++;
    } catch {
      /* one bad or contradictory row must not block the others */
    }
  }
  if (baseline) {
    w.relief = relief;
    w.lastUsageTick = lastUsageTick;
  }
  return changed;
}
