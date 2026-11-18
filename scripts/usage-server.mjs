// Local, read-only usage bridge for Tokenfall. Run it yourself:
//   node scripts/usage-server.mjs [port=5175] [days=3]
// GET http://127.0.0.1:<port>/usage -> normalized events (token counters only).
// Reads Claude Code transcripts (~/.claude/projects) and Codex sessions
// (~/.codex/sessions). Conversation text is never kept or sent. Listens on
// loopback only and answers only to local browser origins.
import { createServer } from "node:http";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const port = Number(process.argv[2] ?? 5175),
  days = Number(process.argv[3] ?? 3);
const roots = {
  claude: join(homedir(), ".claude", "projects"),
  codex: join(homedir(), ".codex", "sessions"),
};
const n = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);

function* walk(dir, since) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, since);
    else if (e.name.endsWith(".jsonl")) {
      const s = statSync(p);
      if (s.mtimeMs >= since) yield [p, s];
    }
  }
}
const lines = (text) =>
  text.split("\n").flatMap((l) => {
    try {
      return l ? [JSON.parse(l)] : [];
    } catch {
      return []; // half-written last line
    }
  });

function claudeEvents(text) {
  const byId = new Map();
  for (const r of lines(text)) {
    const m = r.message,
      u = m?.usage;
    if (r.type !== "assistant" || !u || typeof m.id !== "string") continue;
    const cached = n(u.cache_read_input_tokens),
      output = n(u.output_tokens),
      thinking = n(u.output_tokens_details?.thinking_tokens),
      input = n(u.input_tokens) + n(u.cache_creation_input_tokens) + cached;
    const old = byId.get(m.id);
    if (old && old.input + old.output > input + output) continue;
    byId.set(m.id, {
      id: m.id,
      session: String(r.sessionId ?? "claude"),
      at: r.timestamp,
      origin: "claude-code",
      provenance: "measured",
      input,
      output,
      cached,
      ...(thinking && thinking <= output ? { reasoning: thinking } : {}),
    });
  }
  return [...byId.values()];
}
function codexEvents(text, file) {
  // token_count carries cumulative totals for the session: one event, growing.
  let id = file.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/)?.[0] ?? file,
    at,
    total;
  for (const r of lines(text)) {
    at ??= r.timestamp;
    const t =
      r.payload?.type === "token_count" && r.payload.info?.total_token_usage;
    if (t) total = t;
  }
  if (!total || !at) return [];
  const output = n(total.output_tokens),
    reasoning = n(total.reasoning_output_tokens);
  return [
    {
      id,
      session: id,
      at,
      origin: "codex",
      provenance: "measured",
      input: n(total.input_tokens),
      output,
      cached: Math.min(n(total.cached_input_tokens), n(total.input_tokens)),
      ...(reasoning && reasoning <= output ? { reasoning } : {}),
    },
  ];
}

const cache = new Map(); // file -> { key, events }
function collect() {
  const since = Date.now() - days * 86400e3,
    out = [];
  for (const [kind, root] of Object.entries(roots))
    for (const [file, s] of walk(root, since)) {
      const key = `${s.mtimeMs}:${s.size}`;
      let hit = cache.get(file);
      if (hit?.key !== key) {
        const text = readFileSync(file, "utf8");
        hit = {
          key,
          events:
            kind === "claude" ? claudeEvents(text) : codexEvents(text, file),
        };
        cache.set(file, hit);
      }
      out.push(...hit.events);
    }
  return out.filter((e) => Date.parse(e.at) >= since);
}

const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && local.test(origin))
    res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  if (req.url?.split("?")[0] !== "/usage" || req.method !== "GET") {
    res.writeHead(404).end();
    return;
  }
  if (origin && !local.test(origin)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(collect()));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(port, "127.0.0.1", () =>
  console.error(
    `Tokenfall usage bridge : http://127.0.0.1:${port}/usage (${days} derniers jours)`,
  ),
);
