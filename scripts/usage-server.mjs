// Local, read-only usage bridge for Tokenfall. Run it yourself:
//   node scripts/usage-server.mjs [port=5175] [days=3]
// GET http://127.0.0.1:<port>/usage -> normalized events (token counters only).
// Reads Claude Code transcripts (~/.claude/projects) and Codex sessions
// (~/.codex/sessions). Conversation text is never kept or sent. Listens on
// loopback only and answers only to local browser origins.
import { parseCodexUsage } from "./codex-usage.mjs";
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
      ...(typeof r.cwd === "string" ? { project: r.cwd } : {}),
      input,
      output,
      cached,
      ...(thinking && thinking <= output ? { reasoning: thinking } : {}),
    });
  }
  return [...byId.values()];
}

const cache = new Map(); // file -> { key, events }
function collect() {
  const since = Date.now() - days * 86400e3,
    out = [],
    completeCodex = new Set(),
    incompleteCodex = new Set();
  for (const [kind, root] of Object.entries(roots))
    for (const [file, s] of walk(root, since)) {
      const key = `${s.mtimeMs}:${s.size}`;
      let hit = cache.get(file);
      if (hit?.key !== key) {
        const text = readFileSync(file, "utf8");
        const parsed = kind === "codex" ? parseCodexUsage(text, file) : null;
        hit = {
          key,
          events: parsed ? parsed.events : claudeEvents(text),
          parsed,
        };
        cache.set(file, hit);
      }
      out.push(...hit.events);
      if (hit.parsed)
        (hit.parsed.complete ? completeCodex : incompleteCodex).add(
          hit.parsed.session,
        );
    }
  // Codex daily replacements include the complete history of recently modified
  // session files, so replacing a legacy cumulative total never drops old days.
  const events = out.filter(
    (e) => e.origin === "codex" || Date.parse(e.at) >= since,
  );
  return {
    version: 2,
    events,
    codexSessions: [...completeCodex].filter((id) => !incompleteCodex.has(id)),
    incompleteCodexSessions: incompleteCodex.size,
  };
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
    const snapshot = collect();
    res.end(
      JSON.stringify(req.url.includes("format=2") ? snapshot : snapshot.events),
    );
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(port, "127.0.0.1", () =>
  console.error(
    `Tokenfall usage bridge : http://127.0.0.1:${port}/usage (${days} derniers jours)`,
  ),
);
