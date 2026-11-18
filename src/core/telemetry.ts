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
    previous.input = Math.max(previous.input, e.input);
    previous.output = Math.max(previous.output, e.output);
    if (e.cached !== undefined)
      previous.cached = Math.max(previous.cached ?? 0, e.cached);
    if (e.reasoning !== undefined)
      previous.reasoning = Math.max(previous.reasoning ?? 0, e.reasoning);
    if (changed) {
      w.lastUsageTick = w.tick;
      w.relief = Math.max(0, w.relief - (delta / w.settings.budget) * 100);
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
    w.relief - ((e.input + e.output) / w.settings.budget) * 100,
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
