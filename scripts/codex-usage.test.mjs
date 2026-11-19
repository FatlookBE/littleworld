import { expect, it } from "vitest";
import { codexEvents, parseCodexUsage } from "./codex-usage.mjs";
const session = "11111111-1111-1111-1111-111111111111";
const row = (at, input, output, cache = 0, reasoning = 0) =>
  JSON.stringify({
    timestamp: at,
    payload: {
      type: "token_count",
      info: {
        last_token_usage: {
          input_tokens: input,
          output_tokens: output,
          cached_input_tokens: cache,
          reasoning_output_tokens: reasoning,
        },
        total_token_usage: {
          input_tokens: input,
          output_tokens: output,
          cached_input_tokens: cache,
          reasoning_output_tokens: reasoning,
        },
      },
    },
  });
it("allocates only cumulative growth to each UTC day, even across midnight", () => {
  const a = row("2026-11-18T23:59:00Z", 100, 20, 50, 10);
  const b = row("2026-11-19T00:01:00Z", 180, 50, 90, 20);
  const events = codexEvents([a, a, b, b, "{partial"].join("\n"), session);
  expect(
    events.map((e) => [e.at, e.input, e.output, e.cached, e.reasoning]),
  ).toEqual([
    ["2026-11-18T00:00:00.000Z", 100, 20, 50, 10],
    ["2026-11-19T00:00:00.000Z", 80, 30, 40, 10],
  ]);
});
it("keeps stable daily IDs when an active session grows", () => {
  const a = row("2026-11-19T10:00:00Z", 100, 20);
  const first = codexEvents(a, session);
  const next = codexEvents(
    a + "\n" + row("2026-11-19T11:00:00Z", 160, 35),
    session,
  );
  expect(next[0].id).toBe(first[0].id);
  expect(next[0].input).toBe(160);
  expect(next[0].output).toBe(35);
});
it("handles reset counters and ignores snapshots without valid dates", () => {
  const events = codexEvents(
    [
      row("2026-11-18T12:00:00Z", 100, 20),
      row("2026-11-19T12:00:00Z", 30, 5),
      row("2026-11-19T13:00:00Z", 45, 9),
      row("invalid", 999, 999),
    ].join("\n"),
    session,
  );
  expect(events.map((e) => [e.input, e.output])).toEqual([
    [100, 20],
    [45, 9],
  ]);
});

it("ignores partial primary counters without resetting the baseline", () => {
  const partial = JSON.stringify({
    timestamp: "2026-11-19T00:01:00Z",
    payload: {
      type: "token_count",
      info: { total_token_usage: { output_tokens: 25 } },
    },
  });
  const events = codexEvents(
    [
      row("2026-11-18T23:00:00Z", 100, 20),
      partial,
      row("2026-11-19T01:00:00Z", 120, 30),
    ].join("\n"),
    session,
  );
  expect(events.map((e) => [e.input, e.output])).toEqual([
    [100, 20],
    [20, 10],
  ]);
});
it("does not allocate inherited cumulative history to the first observed day", () => {
  const first = JSON.parse(row("2026-11-19T00:01:00Z", 10000, 2000));
  first.payload.info.last_token_usage = { input_tokens: 40, output_tokens: 5 };
  const parsed = parseCodexUsage(JSON.stringify(first), session);
  expect(parsed.complete).toBe(false);
  expect(parsed.events.map((e) => [e.input, e.output])).toEqual([[40, 5]]);
  delete first.payload.info.last_token_usage;
  expect(parseCodexUsage(JSON.stringify(first), session)).toMatchObject({
    complete: false,
    events: [],
  });
});

it("exposes only project metadata, never session messages", () => {
  const text =
    JSON.stringify({
      type: "session_meta",
      payload: { cwd: "/project/a", instructions: "private" },
    }) +
    "\n" +
    row("2026-11-19T10:00:00Z", 100, 10);
  const parsed = parseCodexUsage(text, session);
  expect(parsed.events[0].project).toBe("/project/a");
  expect(JSON.stringify(parsed)).not.toContain("private");
});
