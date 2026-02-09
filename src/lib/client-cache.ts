'use client'

/**
 * Simple in-memory client-side cache for Supabase queries.
 * Data survives across navigations (SPA-style), cleared on full page reload.
 * iPhone-era devices can easily handle this in memory.
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

export function getCached<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > entry.ttl) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  store.set(key, { data, timestamp: Date.now(), ttl })
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
