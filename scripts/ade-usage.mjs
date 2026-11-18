// Export ADE's per-turn token ledger (Claude, Codex, ...) as Tokenfall events.
// Usage: node scripts/ade-usage.mjs [days=7] > usage.json
// Whitelist only: turn key, session, time, provider and token counters.
// Paths, e-mails, model names and costs are never copied.
import { execFileSync } from "node:child_process";

const days = Number(process.argv[2] ?? 7);
if (!Number.isInteger(days) || days < 1 || days > 90) {
  console.error("Usage: node scripts/ade-usage.mjs [days 1-90]");
  process.exit(1);
}
const LIMIT = 200; // ade returns at most 200 recent turns per call: read 6 h windows
const STEP = 6 * 3600e3;
const n = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
const byKey = new Map();
const end = Date.now();
for (let from = end - days * 86400e3; from < end; from += STEP) {
  const raw = execFileSync(
    "ade",
    [
      "usage",
      "turns",
      "--group-by",
      "provider",
      "--recent",
      String(LIMIT),
      "--since",
      new Date(from).toISOString(),
      "--until",
      new Date(Math.min(end, from + STEP)).toISOString(),
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const recent = JSON.parse(raw).recent ?? [];
  if (recent.length >= LIMIT)
    console.error(
      `Attention : fenêtre ${new Date(from).toISOString()} tronquée.`,
    );
  for (const t of recent) {
    if (t.status !== "completed" || typeof t.key !== "string") continue;
    const cacheRead = n(t.cacheReadTokens),
      output = n(t.outputTokens),
      reasoning = n(t.reasoningTokens);
    byKey.set(t.key, {
      id: t.key,
      session: String(t.sessionId ?? "ade"),
      at: t.at,
      origin: `ade-${t.provider}`,
      provenance: t.usageConfidence === "measured" ? "measured" : "estimated",
      input: n(t.inputTokens) + n(t.cacheWriteTokens) + cacheRead,
      output,
      cached: cacheRead,
      ...(reasoning && reasoning <= output ? { reasoning } : {}),
    });
  }
}
const events = [...byKey.values()].sort(
  (a, b) => Date.parse(a.at) - Date.parse(b.at),
);
console.log(JSON.stringify(events, null, 2));
