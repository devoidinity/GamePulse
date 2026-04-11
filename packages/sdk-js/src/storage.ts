import type { KeyValueStorage } from "./types.js";

/** In-memory fallback for Node / SSR / private-mode browsers. */
class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

/** Picks localStorage when usable, else an in-memory store. */
export function detectStorage(): KeyValueStorage {
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__gp_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return localStorage as KeyValueStorage;
    }
  } catch {
    // localStorage present but blocked (Safari private mode) -> fall through.
  }
  return new MemoryStorage();
}
