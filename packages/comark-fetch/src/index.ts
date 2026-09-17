/**
 * comark-fetch — Comark plugin that resolves `fetch:` frontmatter at parse
 * time, writing results to `tree.meta.fetch`.
 *
 * @example
 * ```ts
 * import { parseMarkdown } from 'comark'
 * import fetchPlugin from 'comark-fetch'
 *
 * const tree = await parseMarkdown(content, {
 *   plugins: [fetchPlugin({ allowOrigins: ['https://api.example.com'] })],
 * })
 * // tree.meta.fetch.posts → JSON payload
 * ```
 *
 * @see https://github.com/miguelrk/comark-packages/tree/main/packages/comark-fetch
 */

import { defineComarkPlugin } from 'comark'
import type { ComarkPluginFactory } from 'comark'
import { isOriginAllowed, originDeniedMessage } from './allowOrigin.ts'
import { assertNoDuplicateFetchKeys } from './duplicates.ts'
import { fetchJsonWithRetry } from './fetchJson.ts'
import { normalizeFetches } from './normalize.ts'
import { getDefaultFetchCache } from './fetchCache.ts'
import { buildFetchKey } from './fetchKey.ts'
import type { FetchConfig, FetchMeta } from './types.ts'
import { validateFetches } from './validate.ts'

export type {
  CredentialsMode,
  FetchConfig,
  FetchEntry,
  FetchEntryInput,
  FetchErrorRecord,
  FetchFrontmatter,
  FetchMeta,
} from './types.ts'

export { findDuplicateFetchKeys, assertNoDuplicateFetchKeys } from './duplicates.ts'
export { normalizeEntry, normalizeFetches } from './normalize.ts'
export { validateEntry, validateFetches } from './validate.ts'
export { isOriginAllowed } from './allowOrigin.ts'
export { buildFetchKey } from './fetchKey.ts'
export {
  FetchCache,
  getDefaultFetchCache,
  resetDefaultFetchCache,
  type FetchCacheOptions,
} from './fetchCache.ts'
export { fetchJson, fetchJsonWithRetry } from './fetchJson.ts'

const fetchPlugin: ComarkPluginFactory<FetchConfig, FetchMeta> = defineComarkPlugin<
  FetchConfig,
  FetchMeta
>((options = {}) => {
  const enabled = options.enabled ?? true
  const allowOrigins = options.allowOrigins ?? []
  const throwOnError = options.throwOnError ?? false
  const hasCustomFetch = typeof options.fetch === 'function'
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)

  return {
    name: 'comark-fetch',

    pre(state) {
      if (!enabled) return
      assertNoDuplicateFetchKeys(state.markdown)
    },

    async post(state) {
      if (!enabled) return

      const raw = (state.tree.frontmatter as Record<string, unknown> | undefined)?.fetch
      const normalized = normalizeFetches(raw)
      if (normalized.length === 0) return

      const { valid, errors, warnings } = validateFetches(normalized)
      for (const w of warnings) console.warn(w)

      const results: Record<string, unknown> = {}
      const fetchErrors: Record<string, { message: string; url?: string }> = { ...errors }

      const entries = valid.filter((item) => item.entry.enabled !== false)

      if (entries.length === 0) {
        if (Object.keys(fetchErrors).length > 0) {
          state.tree.meta.fetchErrors = {
            ...state.tree.meta.fetchErrors,
            ...fetchErrors,
          }
        }
        return
      }

      const cache = options.cache ?? getDefaultFetchCache()

      const settled = await Promise.allSettled(
        entries.map(async ({ name, entry }) => {
          if (!isOriginAllowed(entry.url, allowOrigins, hasCustomFetch)) {
            throw Object.assign(new Error(originDeniedMessage(entry.url)), {
              url: entry.url,
            })
          }

          const cacheKey = JSON.stringify(buildFetchKey(name, entry))

          return cache.resolve(
            cacheKey,
            () => fetchJsonWithRetry({ entry, fetchImpl }),
            {
              staleTime: entry.staleTime,
              gcTime: entry.gcTime,
            },
          )
        }),
      )

      for (let i = 0; i < settled.length; i++) {
        const result = settled[i]!
        const { name, entry } = entries[i]!

        if (result.status === 'fulfilled') {
          results[name] = result.value
        } else {
          const err = result.reason
          const message =
            err instanceof Error ? err.message : `Fetch "${name}" failed: ${String(err)}`
          fetchErrors[name] = {
            message,
            url: entry.url,
          }
          if (throwOnError) {
            throw err instanceof Error ? err : new Error(message)
          }
        }
      }

      if (Object.keys(results).length > 0) {
        state.tree.meta.fetch = { ...state.tree.meta.fetch, ...results }
      }
      if (Object.keys(fetchErrors).length > 0) {
        state.tree.meta.fetchErrors = {
          ...state.tree.meta.fetchErrors,
          ...fetchErrors,
        }
      }
    },
  }
})

export default fetchPlugin
