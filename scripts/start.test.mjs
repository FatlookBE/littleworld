import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { startServices } from "./start.mjs";
afterEach(() => vi.useRealTimers());
function harness() {
  const children = [],
    signals = new EventEmitter();
  const spawnChild = vi.fn(() => {
    const child = new EventEmitter();
    child.kill = vi.fn(() => {
      queueMicrotask(() => child.emit("close", 0, "SIGTERM"));
      return true;
    });
    children.push(child);
    return child;
  });
  return {
    children,
    signals,
    spawnChild,
    probe: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
  };
}
it("checks both stable ports before starting either service", async () => {
  const h = harness();
  h.probe.mockRejectedValueOnce(new Error("port occupied"));
  await expect(startServices(h)).rejects.toThrow("port occupied");
  expect(h.spawnChild).not.toHaveBeenCalled();
});
it("starts both services on fixed ports and stops only its children on Ctrl+C", async () => {
  const h = harness();
  const running = await startServices(h);
  expect(h.probe.mock.calls).toEqual([[5174], [5175]]);
  expect(h.spawnChild.mock.calls[0][1]).toContain("--strictPort");
  expect(h.spawnChild.mock.calls[0][1]).toContain("5174");
  expect(h.spawnChild.mock.calls[1][1]).toContain("5175");
  h.signals.emit("SIGINT");
  expect(await running.done).toBe(0);
  expect(h.children.every((c) => c.kill.mock.calls[0][0] === "SIGTERM")).toBe(
    true,
  );
  expect(h.signals.listenerCount("SIGINT")).toBe(0);
});
it("stops the other service and reports failure when one child exits", async () => {
  const h = harness();
  const running = await startServices(h);
  h.children[1].emit("close", 1, null);
  expect(await running.done).toBe(1);
  expect(h.children[0].kill).toHaveBeenCalledWith("SIGTERM");
});
it("cleans up a first child when starting the second fails synchronously", async () => {
  const h = harness();
  const normal = h.spawnChild.getMockImplementation();
  h.spawnChild.mockImplementationOnce(normal).mockImplementationOnce(() => {
    throw new Error("spawn failed");
  });
  const running = await startServices(h);
  expect(await running.done).toBe(1);
  expect(h.children[0].kill).toHaveBeenCalledWith("SIGTERM");
});
