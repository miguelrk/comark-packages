import type { FetchCache } from './fetchCache.ts'

/**
 * Full frontmatter fetch entry after shorthand expansion.
 * Transport fields mirror a subset of `RequestInit`.
 */
export interface FetchEntry {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  credentials?: CredentialsMode
  /** Cache freshness in ms. @default 0 (always refetch). */
  staleTime?: number
  /** Evict cached entries after this many ms. @default 300_000 */
  gcTime?: number
  /** Retry count after the first failed attempt. @default false (no retries). */
  retry?: number | boolean
  enabled?: boolean
}

export type CredentialsMode = 'omit' | 'same-origin' | 'include'

/** Raw frontmatter value: bare URL string or full object. */
export type FetchEntryInput = string | FetchEntry

export type FetchFrontmatter = Record<string, FetchEntryInput>

export interface FetchErrorRecord {
  message: string
  url?: string
}

/** Keys this plugin contributes to `tree.meta`. */
export interface FetchMeta {
  fetch?: Record<string, unknown>
  fetchErrors?: Record<string, FetchErrorRecord>
}

/**
 * Options for the comark-fetch plugin factory.
 */
export interface FetchConfig {
  /** Set to `false` to disable the plugin. @default true */
  enabled?: boolean
  /**
   * Allowed URL origins for outbound requests. Empty (default) denies all
   * unless a custom `fetch` is supplied. Use `['*']` to allow any http(s) origin
   * when document authors are trusted.
   */
  allowOrigins?: string[]
  /** Custom fetch implementation (also bypasses the empty-allowlist deny). */
  fetch?: typeof globalThis.fetch
  /** Host-injected cache. When omitted, a process-level singleton is used. */
  cache?: FetchCache
  /** If true, a failed fetch rejects the parse instead of writing fetchErrors. @default false */
  throwOnError?: boolean
}

export interface NormalizedFetch {
  name: string
  entry: FetchEntry
}

export interface FetchKeyParts {
  url: string
  method: string
  body?: string
  headers?: Record<string, string>
}
