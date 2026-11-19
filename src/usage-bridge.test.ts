import { afterEach, expect, it, vi } from "vitest";
import { readUsageBridge } from "./usage-bridge";
afterEach(() => vi.unstubAllGlobals());
const signal = () => new AbortController().signal;
it("supports daily snapshots and the legacy event array", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          version: 2,
          events: [],
          codexSessions: ["s", 4],
          incompleteCodexSessions: 2,
        }),
      ),
    )
    .mockResolvedValueOnce(new Response("[]"));
  vi.stubGlobal("fetch", fetch);
  expect(await readUsageBridge(signal())).toEqual({
    events: [],
    codexSessions: ["s"],
    incomplete: 2,
  });
  expect(await readUsageBridge(signal())).toEqual({
    events: [],
    codexSessions: [],
    incomplete: 0,
  });
});
it("distinguishes network, HTTP and invalid data errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("not JSON")),
  );
  await expect(readUsageBridge(signal())).rejects.toThrow("Connexion au pont");
  await expect(readUsageBridge(signal())).rejects.toThrow("HTTP 500");
  await expect(readUsageBridge(signal())).rejects.toThrow("illisibles");
});
it("passes cancellation to fetch and reports a timed-out request", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetch = vi
    .fn()
    .mockRejectedValue(new DOMException("Aborted", "AbortError"));
  vi.stubGlobal("fetch", fetch);
  await expect(readUsageBridge(controller.signal)).rejects.toThrow(
    "8 secondes",
  );
  expect(fetch).toHaveBeenCalledWith(expect.any(String), {
    cache: "no-store",
    signal: controller.signal,
  });
});
