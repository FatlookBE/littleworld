import { expect, it } from "vitest";
import { ClaudeAdapter } from "./telemetry";

const row = (id: string, out: number, extra = {}) =>
  JSON.stringify({
    type: "assistant",
    sessionId: "s1",
    timestamp: "2026-11-18T10:00:00.000Z",
    message: {
      id,
      content: "secret prompt text",
      usage: {
        input_tokens: 2,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 50,
        output_tokens: out,
        ...extra,
      },
    },
  });

it("reads Claude Code usage, merges streamed rows and drops content", () => {
  const text = [
    row("m1", 10),
    row("m1", 40, { output_tokens_details: { thinking_tokens: 5 } }),
    row("m2", 7),
    JSON.stringify({ type: "user", message: { content: "hi" } }),
    '{"type":"assis',
  ].join("\n");
  const events = new ClaudeAdapter().read(text);
  expect(events).toHaveLength(2);
  expect(events[0]).toMatchObject({
    id: "m1",
    origin: "claude-code",
    input: 152,
    cached: 50,
    output: 40,
    reasoning: 5,
  });
  expect(JSON.stringify(events)).not.toContain("secret");
  expect(() => new ClaudeAdapter().read("{}")).toThrow();
});
