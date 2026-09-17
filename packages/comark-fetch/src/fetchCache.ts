export interface FetchCacheOptions {
  /** Default stale time in ms when an entry omits `staleTime`. @default 0 */
  defaultStaleTime?: number
  /** Default gc time in ms when an entry omits `gcTime`. @default 300_000 */
  defaultGcTime?: number
}

interface CacheEntry {
  data: unknown
  fetchedAt: number
}

export class FetchCache {
  private entries = new Map<string, CacheEntry>()

  constructor(private options: FetchCacheOptions = {}) {}

  async resolve(
    key: string,
    fn: () => Promise<unknown>,
    opts: { staleTime?: number; gcTime?: number } = {},
  ): Promise<unknown> {
    const staleTime = opts.staleTime ?? this.options.defaultStaleTime ?? 0
    const gcTime = opts.gcTime ?? this.options.defaultGcTime ?? 300_000
    const now = Date.now()
    const hit = this.entries.get(key)

    if (
      hit &&
      (staleTime === Infinity || now - hit.fetchedAt < staleTime)
    ) {
      return hit.data
    }

    const data = await fn()
    this.entries.set(key, { data, fetchedAt: now })
    this.prune(now, gcTime)
    return data
  }

  clear(): void {
    this.entries.clear()
  }

  private prune(now: number, gcTime: number): void {
    if (gcTime === Infinity) return
    for (const [key, entry] of this.entries) {
      if (now - entry.fetchedAt > gcTime) {
        this.entries.delete(key)
      }
    }
  }
}

let singleton: FetchCache | undefined

/** Process-level cache used when the host does not inject one. */
export const getDefaultFetchCache = (): FetchCache => {
  if (!singleton) singleton = new FetchCache()
  return singleton
}

/** Test helper — reset the singleton between tests. */
export const resetDefaultFetchCache = (): void => {
  singleton?.clear()
  singleton = undefined
}
