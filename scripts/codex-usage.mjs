// Counter-only parsing; incomplete history must never masquerade as daily usage.
const valid = (v) => Number.isSafeInteger(v) && v >= 0;
function counters(t) {
  if (!t || !valid(t.input_tokens) || !valid(t.output_tokens)) return null;
  return {
    input: t.input_tokens,
    output: t.output_tokens,
    cached: Math.min(
      valid(t.cached_input_tokens) ? t.cached_input_tokens : 0,
      t.input_tokens,
    ),
    reasoning: Math.min(
      valid(t.reasoning_output_tokens) ? t.reasoning_output_tokens : 0,
      t.output_tokens,
    ),
  };
}
const keys = ["input", "output", "cached", "reasoning"];
export function parseCodexUsage(text, file) {
  const session = file.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/)?.[0] ?? file;
  const days = new Map(),
    seen = new Set();
  let previous = null,
    complete = true,
    project;
  for (const line of text.split("\n")) {
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    if (r?.type === "session_meta" && typeof r.payload?.cwd === "string")
      project = r.payload.cwd;
    if (r?.payload?.type !== "token_count") continue;
    const info = r.payload.info;
    const current = counters(info?.total_token_usage);
    if (!current || !Number.isFinite(Date.parse(r.timestamp))) continue;
    const at = new Date(r.timestamp).toISOString();
    const key = JSON.stringify([at, current]);
    if (seen.has(key)) continue;
    seen.add(key);
    const reset =
      !previous ||
      current.input < previous.input ||
      current.output < previous.output;
    let delta;
    if (reset) {
      const last = counters(info?.last_token_usage);
      const zero = keys.every((k) => current[k] === 0);
      const full = last && keys.every((k) => current[k] === last[k]);
      // last_token_usage dates only that observation, never its inherited total.
      delta = last && keys.every((k) => last[k] <= current[k]) ? last : null;
      if (!zero && !full) complete = false;
    } else {
      delta = Object.fromEntries(
        keys.map((k) => [k, Math.max(0, current[k] - previous[k])]),
      );
    }
    previous = current;
    if (!delta || (!delta.input && !delta.output)) continue;
    const day = at.slice(0, 10);
    const event = days.get(day) ?? {
      id: `codex-day:${session}:${day}`,
      session,
      at: `${day}T00:00:00.000Z`,
      origin: "codex",
      provenance: "measured",
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
    };
    event.input += delta.input;
    event.output += delta.output;
    event.cached += Math.min(delta.cached, delta.input);
    event.reasoning += Math.min(delta.reasoning, delta.output);
    days.set(day, event);
  }
  for (const event of days.values()) if (project) event.project = project;
  return {
    session,
    events: [...days.values()],
    complete: Boolean(previous) && complete,
  };
}
export const codexEvents = (text, file) => parseCodexUsage(text, file).events;
