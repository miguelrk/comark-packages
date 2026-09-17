/** Plugin factory options. */
export interface KvConfig {
  /** @default true */
  enabled?: boolean
}

/** Known unstorage driver names supported out of the box. */
export type KvDriverName = 'browser' | 'memory' | 'http' | (string & {})

/**
 * Normalized single-driver `kv:` descriptor written to `tree.meta.kv`.
 * Storage I/O happens at runtime via `createKvModel`, not at parse time.
 *
 * Frontmatter (single-driver form):
 * ```yaml
 * kv:
 *   driver: browser
 *   mount: prefs
 *   default:
 *     name: Ada
 * ```
 * Model paths: `kv.name`, `kv.subscribed`, …
 */
export interface KvDescriptor {
  /** unstorage driver name (`browser`, `memory`, `http`, …). */
  driver: KvDriverName
  /**
   * Key prefix within the driver (storage keys are `mount:key`).
   * @default 'kv'
   */
  mount: string
  /** Required when `driver` is `http` — base URL for the proxied store. */
  base?: string
  /**
   * Per-key fallback values applied only when a key is absent in storage.
   * Used as the synchronous SSR / first-paint seed.
   */
  default?: Record<string, unknown>
  /**
   * When `true`, this namespace is a single remote resource at `base`
   * (from the URL shortcut `ns: https://…`). Model path is `kv.<ns>`
   * (the whole value), not `kv.<ns>.key`.
   */
  resource?: boolean
}

/**
 * Multi-driver namespace map.
 * Each key becomes a sub-namespace under `kv.*` in the model.
 *
 * Frontmatter (multi-driver form):
 * ```yaml
 * kv:
 *   local:
 *     driver: browser
 *     mount: prefs
 *     default:
 *       name: Ada
 *   session:
 *     driver: memory
 *     mount: ui
 *     default:
 *       draft: ""
 *   # URL shortcut → driver: http, resource: true
 *   posts: https://jsonplaceholder.typicode.com/posts?_limit=5
 * ```
 * Model paths: `kv.local.name`, `kv.session.draft`, `kv.posts`, …
 */
export type KvNamespaceMap = Record<string, KvDescriptor>

/**
 * Union of the two valid `kv:` forms.
 * - `KvDescriptor` — single driver, paths `kv.<key>`
 * - `KvNamespaceMap` — multiple drivers, paths `kv.<ns>.<key>` (or `kv.<ns>` for resources)
 */
export type KvSchema = KvDescriptor | KvNamespaceMap

/**
 * Return `true` when `schema` is the single-driver form.
 * Narrows `KvSchema` to `KvDescriptor`.
 */
export const isSingleDriverSchema = (schema: KvSchema): schema is KvDescriptor =>
  typeof (schema as KvDescriptor).driver === 'string'

/** Raw frontmatter shape under `kv:`. */
export type KvFrontmatter =
  | (Partial<KvDescriptor> & {
      driver?: KvDriverName
      mount?: string
      base?: string
      default?: Record<string, unknown>
    })
  | Record<string, Partial<KvDescriptor> | string>

/** Keys this plugin adds to `tree.meta`. */
export interface KvMeta {
  kv?: KvSchema
  kvErrors?: Record<string, string>
}
