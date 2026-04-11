import { describe, expect, it, vi } from "vitest";
import { GamePulse } from "./index.js";
import type { KeyValueStorage } from "./types.js";

function memStorage(): KeyValueStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const okResponse = () =>
  ({ ok: true, status: 202, json: async () => ({}) }) as Response;

describe("GamePulse SDK", () => {
  it("batches and flushes at flushAt", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const gp = new GamePulse({
      apiKey: "gp_live_test",
      endpoint: "https://api.test",
      flushAt: 3,
      flushIntervalMs: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      storage: memStorage(),
      playerId: "p1",
    });

    gp.track("a");
    gp.track("b");
    expect(fetchImpl).not.toHaveBeenCalled();
    gp.track("c"); // hits flushAt -> flush
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.test/api/v1/events");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.events).toHaveLength(3);
    expect((init as RequestInit).headers).toMatchObject({ "x-api-key": "gp_live_test" });
  });

  it("drops on 4xx but keeps events on 5xx", async () => {
    const storage = memStorage();
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }) as Response);
    const gp = new GamePulse({
      apiKey: "k",
      endpoint: "https://api.test",
      flushIntervalMs: 0,
      maxRetries: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      storage,
      playerId: "p1",
    });
    gp.track("x");
    await gp.flush();
    // 5xx is retryable -> event stays in the persisted offline queue.
    expect(JSON.parse(storage.getItem("gamepulse:queue")!)).toHaveLength(1);
  });

  it("restores the offline queue from storage on construct", async () => {
    const storage = memStorage();
    storage.setItem(
      "gamepulse:queue",
      JSON.stringify([{ eventName: "old", playerId: "p1", timestamp: new Date().toISOString(), properties: {} }]),
    );
    const fetchImpl = vi.fn(async () => okResponse());
    const gp = new GamePulse({
      apiKey: "k",
      endpoint: "https://api.test",
      flushIntervalMs: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      storage,
    });
    await gp.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.getItem("gamepulse:queue")!)).toHaveLength(0);
  });
});
