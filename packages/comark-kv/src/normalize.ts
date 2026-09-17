import type { KvDescriptor, KvNamespaceMap, KvSchema } from './types.ts'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * True for URL / path strings used as the http-driver shortcut:
 * `posts: https://…` or `posts: /api/posts`.
 */
export const isHttpShortcut = (value: unknown): value is string =>
  typeof value === 'string' &&
  (value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/'))

const normalizeSingle = (input: Record<string, unknown>): KvDescriptor => {
  const driver = typeof input['driver'] === 'string' ? input['driver'] : ''
  const mount =
    typeof input['mount'] === 'string' && input['mount'].length > 0 ? input['mount'] : 'kv'
  const base = typeof input['base'] === 'string' ? input['base'] : undefined
  const defaults = isPlainObject(input['default']) ? { ...input['default'] } : undefined
  const resource = input['resource'] === true ? true : undefined

  const desc: KvDescriptor = { driver, mount }
  if (base !== undefined) desc.base = base
  if (defaults !== undefined) desc.default = defaults
  if (resource) desc.resource = true
  return desc
}

/**
 * Expand a URL/path string into an http resource descriptor.
 * `mount` defaults to the namespace name.
 */
export const normalizeHttpShortcut = (url: string, mount: string): KvDescriptor => ({
  driver: 'http',
  mount,
  base: url,
  resource: true,
})

/**
 * Convert raw `frontmatter.kv` into a normalized {@link KvSchema}.
 *
 * - If the value has a string `driver` field → single-driver {@link KvDescriptor}.
 * - If every value is a plain object or an http URL/path string → multi-driver
 *   {@link KvNamespaceMap} (strings expand to `{ driver: 'http', base, resource: true }`).
 * - Otherwise → `null`.
 */
export const normalizeKv = (raw: unknown): KvSchema | null => {
  if (!isPlainObject(raw)) return null

  // Single-driver form: top-level object has a `driver` string
  if (typeof raw['driver'] === 'string') {
    return normalizeSingle(raw)
  }

  // Multi-driver form: every value is a plain object or an http URL shortcut
  const entries = Object.entries(raw)
  if (entries.length === 0) return null
  if (!entries.every(([, v]) => isPlainObject(v) || isHttpShortcut(v))) return null

  const map: KvNamespaceMap = {}
  for (const [ns, val] of entries) {
    map[ns] = isHttpShortcut(val)
      ? normalizeHttpShortcut(val, ns)
      : normalizeSingle(val as Record<string, unknown>)
  }
  return map
}
