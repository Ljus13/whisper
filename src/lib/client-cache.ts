'use client'

/**
 * Hybrid client-side cache: in-memory Map + localStorage persistence.
 * - In-memory for speed; localStorage so cache survives page refreshes.
 * - Stale-while-revalidate: getCached returns stale data with a flag so UI
 *   can show it instantly while a background fetch refreshes.
 * - Debounce helper for realtime handlers.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const store = new Map<string, CacheEntry<unknown>>()

/** Default TTL: 2 minutes for most data */
const DEFAULT_TTL = 2 * 60 * 1000

/** Long TTL: 10 minutes for reference data that rarely changes (skill types, pathways, sequences) */
export const REF_TTL = 10 * 60 * 1000

/** Max stale age: serve stale data up to 10 min past TTL */
const STALE_MAX = 10 * 60 * 1000

const LS_PREFIX = 'wc:'

// ── localStorage helpers (safe for SSR / quota errors) ──

function lsGet<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry<T>
  } catch { return null }
}

function lsSet<T>(key: string, entry: CacheEntry<T>): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
  } catch {
    // quota exceeded — evict oldest entries
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith(LS_PREFIX)) keys.push(k)
      }
      keys.sort()
      for (let i = 0; i < Math.min(10, keys.length); i++) localStorage.removeItem(keys[i])
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
    } catch { /* give up silently */ }
  }
}

function lsDelete(key: string): void {
  try { localStorage.removeItem(LS_PREFIX + key) } catch {}
}

function lsDeletePrefix(prefix: string): void {
  try {
    const full = LS_PREFIX + prefix
    const toDelete: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(full)) toDelete.push(k)
    }
    toDelete.forEach(k => localStorage.removeItem(k))
  } catch {}
}

// ── Public API ──

export function getCached<T>(key: string): T | null {
  // 1. Try in-memory first
  let entry = store.get(key) as CacheEntry<T> | undefined
  // 2. Fall back to localStorage
  if (!entry) {
    const lsEntry = lsGet<T>(key)
    if (lsEntry) {
      store.set(key, lsEntry) // promote to memory
      entry = lsEntry
    }
  }
  if (!entry) return null
  const age = Date.now() - entry.timestamp
  if (age > entry.ttl + STALE_MAX) {
    store.delete(key)
    lsDelete(key)
    return null
  }
  return entry.data
}

/** Check if cached data is stale (past TTL but within STALE_MAX) */
export function isCacheStale(key: string): boolean {
  const entry = store.get(key)
  if (!entry) return true
  return Date.now() - entry.timestamp > entry.ttl
}

export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl }
  store.set(key, entry)
  lsSet(key, entry)
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear()
    try {
      const toDelete: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith(LS_PREFIX)) toDelete.push(k)
      }
      toDelete.forEach(k => localStorage.removeItem(k))
    } catch {}
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key)
      lsDelete(key)
    }
  }
  lsDeletePrefix(prefix)
}

// ── Debounce utility for realtime handlers ──

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function debouncedCall(key: string, fn: () => void, ms: number = 500): void {
  const existing = debounceTimers.get(key)
  if (existing) clearTimeout(existing)
  debounceTimers.set(key, setTimeout(() => {
    debounceTimers.delete(key)
    fn()
  }, ms))
}
