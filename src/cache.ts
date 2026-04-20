import type { FlightsSearchResult } from "./parse.js";

export interface CacheEntry {
  expiresAt: number;
  value: Promise<FlightsSearchResult>;
}

export interface SessionCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
}

export class SessionCache {
  readonly maxEntries: number;
  readonly ttlMs: number;
  private readonly entries = new Map<string, CacheEntry>();

  constructor(options: SessionCacheOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 100);
    this.ttlMs = Math.max(0, options.ttlMs ?? 5 * 60_000);
  }

  get(key: string): Promise<FlightsSearchResult> | undefined {
    const existing = this.entries.get(key);
    if (!existing) {
      return undefined;
    }

    if (existing.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, existing);
    return existing.value;
  }

  set(key: string, value: Promise<FlightsSearchResult>): Promise<FlightsSearchResult> {
    this.evictExpired();

    const wrapped = value.catch((error) => {
      this.entries.delete(key);
      throw error;
    });

    this.entries.delete(key);
    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value: wrapped
    });

    this.evictOverflow();
    return wrapped;
  }

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    this.evictExpired();
    return this.entries.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt < now) {
        this.entries.delete(key);
      }
    }
  }

  private evictOverflow(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        return;
      }
      this.entries.delete(oldestKey);
    }
  }
}

export const defaultSessionCache = new SessionCache();
