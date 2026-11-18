// Save whitelisted usage only. Never persist prompt/code/command item contents.
import { createInterface } from "node:readline";
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
let session = "",
  ordinal = 0;
const events = [];
for await (const line of lines) {
  try {
    const row = JSON.parse(line);
    if (row.type === "thread.started" && typeof row.thread_id === "string") {
      session = row.thread_id;
      ordinal = 0;
    }
    if (row.type !== "turn.completed" || !row.usage) continue;
    if (!session) throw Error("thread.started missing");
    const u = row.usage;
    if (
      ![u.input_tokens, u.output_tokens].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      )
    )
      throw Error("Invalid usage");
    events.push({
      id: `${session}:turn:${ordinal++}`,
      session,
      at: row.timestamp ?? "1970-01-01T00:00:00.000Z",
      origin: "codex-exec",
      provenance: "measured",
      input: u.input_tokens,
      output: u.output_tokens,
      ...(u.cached_input_tokens === undefined
        ? {}
        : { cached: u.cached_input_tokens }),
      ...(u.reasoning_output_tokens === undefined
        ? {}
        : { reasoning: u.reasoning_output_tokens }),
    });
  } catch {
    process.stderr.write("Invalid telemetry stream; no dataset produced.\n");
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode)
  process.stdout.write(JSON.stringify(events, null, 2) + "\n");
