/**
 * comark-kv — Comark plugin for unstorage-backed key-value state.
 *
 * Parse time: normalizes `kv:` frontmatter into `tree.meta.kv`.
 * Runtime: use `createKvModel` / `useKvModel` to bind a live `ComarkModel`.
 *
 * **Single-driver form** — paths `kv.<key>`:
 * ```ts
 * import { parseMarkdown } from 'comark'
 * import kv from 'comark-kv'
 * import { createKvModel } from 'comark-kv/model'
 *
 * const tree = await parseMarkdown(content, { plugins: [kv()] })
 * const { model, ready, dispose } = await createKvModel(tree.meta.kv!)
 * await ready
 * model.get('kv.name')
 * ```
 *
 * **Multi-driver form** — paths `kv.<ns>.<key>` (or `kv.<ns>` for URL resources):
 * ```ts
 * // frontmatter:
 * //   kv:
 * //     local: { driver, mount, default }
 * //     posts: https://api.example.com/posts
 * const { model } = await createKvModel(tree.meta.kv!)
 * model.get('kv.local.name')
 * model.get('kv.posts')        // whole remote resource
 * ```
 *
 * @see https://github.com/miguelrk/comark-kv
 */

import { defineComarkPlugin } from 'comark'
import type { ComarkPluginFactory } from 'comark'
import { assertNoDuplicateKvDefaultKeys } from './duplicates.ts'
import { normalizeKv } from './normalize.ts'
import type { KvConfig, KvMeta } from './types.ts'
import { validateKv } from './validate.ts'

export type {
  KvConfig,
  KvDescriptor,
  KvDriverName,
  KvFrontmatter,
  KvMeta,
  KvNamespaceMap,
  KvSchema,
} from './types.ts'
export { isSingleDriverSchema } from './types.ts'

export { assertNoDuplicateKvDefaultKeys, findDuplicateKvDefaultKeys } from './duplicates.ts'
export { isHttpShortcut, normalizeHttpShortcut, normalizeKv } from './normalize.ts'
export { validateKv } from './validate.ts'
export type { ValidateKvResult } from './validate.ts'

const kvPlugin: ComarkPluginFactory<KvConfig, KvMeta> = defineComarkPlugin<KvConfig, KvMeta>(
  (options = {}) => {
    const enabled = options.enabled ?? true

    return {
      name: 'comark-kv',

      pre(state) {
        if (!enabled) return
        assertNoDuplicateKvDefaultKeys(state.markdown)
      },

      post(state) {
        if (!enabled) return

        const raw = (state.tree.frontmatter as Record<string, unknown> | undefined)?.['kv']
        if (raw === undefined) return

        const schema = normalizeKv(raw)
        if (!schema) {
          state.tree.meta = {
            ...state.tree.meta,
            kvErrors: { kv: 'kv frontmatter must be an object with a driver or a map of driver objects' },
          }
          return
        }

        const { ok, errors } = validateKv(schema)
        if (!ok) {
          state.tree.meta = {
            ...state.tree.meta,
            kvErrors: errors,
          }
          return
        }

        state.tree.meta = {
          ...state.tree.meta,
          kv: schema,
        }
      },
    }
  },
)

export default kvPlugin
