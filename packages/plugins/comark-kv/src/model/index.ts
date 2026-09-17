/**
 * Runtime model factory — bridges a {@link KvSchema} to a live
 * {@link ComarkModel} backed by unstorage.
 *
 * **Single-driver** (`kv.key`):
 * ```ts
 * import { createKvModel } from 'comark-kv/model'
 *
 * const { model, ready, dispose } = await createKvModel({
 *   driver: 'memory',
 *   mount: 'prefs',
 *   default: { name: 'Ada' },
 * })
 * await ready
 * model.get('kv.name')    // 'Ada'
 * model.set('kv.name', 'Bob')
 * dispose()
 * ```
 *
 * **Multi-driver** (`kv.<ns>.<key>` or `kv.<ns>` for URL resources):
 * ```ts
 * const { model, ready, dispose, storages } = await createKvModel({
 *   local: { driver: 'browser', mount: 'prefs', default: { name: 'Ada' } },
 *   session: { driver: 'memory', mount: 'ui', default: { draft: '' } },
 *   posts: { driver: 'http', mount: 'posts', base: 'https://…/posts', resource: true },
 * })
 * await ready
 * model.get('kv.local.name')     // 'Ada'
 * model.get('kv.session.draft')  // ''
 * model.get('kv.posts')          // remote JSON
 * storages.local.getItem('prefs:name')
 * dispose()
 * ```
 */

import { createModelStore } from 'comark/model'
import type { ComarkModel } from 'comark/model'
import { createStorage } from 'unstorage'
import type { Driver, Storage } from 'unstorage'
import type { KvDescriptor, KvSchema } from '../types.ts'
import { isSingleDriverSchema } from '../types.ts'
import { keyFromStorageKey, resolveDriver, storageKey } from './drivers.ts'
import type { ResolveDriverOptions } from './drivers.ts'

export { keyFromStorageKey, resolveDriver, storageKey } from './drivers.ts'
export type { ResolveDriverOptions } from './drivers.ts'

export interface CreateKvModelOptions extends ResolveDriverOptions {
  /**
   * Per-namespace driver injection for multi-driver form.
   * Keys must match namespace names in the `KvNamespaceMap`.
   */
  drivers?: Record<string, Driver>
  /**
   * Extra top-level writable namespaces to include alongside `kv`
   * (e.g. `['data']` when composing with app data).
   */
  writable?: readonly string[]
  /**
   * Initial values for other namespaces (merged under the store root).
   * The `kv` key is always owned by this factory.
   */
  data?: Record<string, unknown>
  /** Called after every accepted write that originated from the model (not storage.watch). */
  onChange?: (path: string, value: unknown, next: Record<string, unknown>) => void
  documentKey?: string
}

export interface KvModelHandle {
  model: ComarkModel
  /** Resolves when initial hydration from all storages finishes. */
  ready: Promise<void>
  /** Tear down all storage watchers. Safe to call multiple times. */
  dispose: () => void
  /**
   * All backing storages keyed by namespace name.
   * - Single-driver form: `{ kv: <storage> }`
   * - Multi-driver form: `{ ns1: <storage1>, ns2: <storage2>, … }`
   */
  storages: Record<string, Storage>
  /**
   * Convenience alias for `storages['kv']` (single-driver) or the first
   * namespace's storage (multi-driver). Use `storages` for explicit access.
   */
  storage: Storage
}

const KV_NAMESPACE = 'kv'

// ---------------------------------------------------------------------------
// Shared internal types
// ---------------------------------------------------------------------------

interface NsState {
  ns: string
  storage: Storage
  mount: string
  defaults: Record<string, unknown>
  lastKnown: Record<string, unknown>
  /** HTTP URL shortcut — whole value lives at `kv.<ns>`, fetched from `base`. */
  resource: boolean
  unwatch?: () => void | Promise<void>
}

/** Empty key → unstorage http driver's `joinURL(base, '')` hits `base` itself. */
const RESOURCE_STORAGE_KEY = ''

// ---------------------------------------------------------------------------
// Single-driver implementation
// ---------------------------------------------------------------------------

const createSingleDriver = async (
  descriptor: KvDescriptor,
  options: CreateKvModelOptions,
): Promise<KvModelHandle> => {
  const driver: Driver = await resolveDriver(descriptor, options)
  const storage = createStorage({ driver })
  const mount = descriptor.mount
  const defaults = { ...(descriptor.default ?? {}) }

  const nsState: NsState = {
    ns: KV_NAMESPACE,
    storage,
    mount,
    defaults,
    lastKnown: { ...defaults },
    resource: false,
  }

  let applyingExternal = false
  let disposed = false

  const persist = async (key: string, value: unknown): Promise<boolean> => {
    try {
      await storage.setItem(storageKey(mount, key), value as string)
      nsState.lastKnown[key] = value
      return true
    } catch (err) {
      console.warn(
        `[comark-kv] Failed to persist "${mount}:${key}": ${err instanceof Error ? err.message : String(err)}`,
      )
      return false
    }
  }

  const pathToKey = (path: string): string | null => {
    const segments = path.split('.')
    if (segments[0] !== KV_NAMESPACE || segments.length < 2) return null
    return segments.slice(1).join('.')
  }

  const model = createModelStore({
    data: {
      ...(options.data ?? {}),
      [KV_NAMESPACE]: { ...defaults },
    },
    writable: [KV_NAMESPACE, ...(options.writable ?? [])],
    documentKey: options.documentKey,
    onChange: (path, value, next) => {
      options.onChange?.(path, value, next)
      if (applyingExternal || disposed) return

      const key = pathToKey(path)
      if (key === null) return

      const previous = nsState.lastKnown[key]
      void persist(key, value).then((ok) => {
        if (ok || disposed) return
        applyingExternal = true
        try {
          model.set(path, previous)
        } finally {
          applyingExternal = false
        }
      })
    },
  })

  const hydrate = async (): Promise<void> => {
    const keys = Object.keys(defaults)
    if (keys.length === 0) return

    applyingExternal = true
    try {
      for (const key of keys) {
        if (disposed) return
        const full = storageKey(mount, key)
        let stored: unknown
        try {
          stored = await storage.getItem(full)
        } catch (err) {
          console.warn(
            `[comark-kv] Failed to read "${full}": ${err instanceof Error ? err.message : String(err)}`,
          )
          continue
        }

        if (stored === null || stored === undefined) {
          await persist(key, defaults[key])
        } else {
          nsState.lastKnown[key] = stored
          model.set(`${KV_NAMESPACE}.${key}`, stored)
        }
      }
    } finally {
      applyingExternal = false
    }
  }

  const ready = hydrate().then(async () => {
    if (disposed) return
    try {
      nsState.unwatch = await storage.watch(async (_event, fullKey) => {
        if (disposed || applyingExternal) return
        const key = keyFromStorageKey(mount, fullKey)
        if (key === null) return

        let stored: unknown
        try {
          stored = await storage.getItem(fullKey)
        } catch {
          return
        }

        applyingExternal = true
        try {
          const value =
            stored === null || stored === undefined ? defaults[key] : stored
          nsState.lastKnown[key] = value
          model.set(`${KV_NAMESPACE}.${key}`, value)
        } finally {
          applyingExternal = false
        }
      })
    } catch {
      // Drivers without watch support are fine — local writes still persist.
    }
  })

  const dispose = () => {
    if (disposed) return
    disposed = true
    const fn = nsState.unwatch
    nsState.unwatch = undefined
    if (fn) void Promise.resolve(fn()).catch(() => {})
  }

  const storages: Record<string, Storage> = { [KV_NAMESPACE]: storage }
  return { model, ready, dispose, storage, storages }
}

// ---------------------------------------------------------------------------
// Multi-driver implementation
// ---------------------------------------------------------------------------

const createMultiDriver = async (
  map: Record<string, KvDescriptor>,
  options: CreateKvModelOptions,
): Promise<KvModelHandle> => {
  const nsEntries = Object.entries(map)

  const nsStates: Record<string, NsState> = {}
  const storagesMap: Record<string, Storage> = {}

  for (const [ns, desc] of nsEntries) {
    const driver: Driver = await resolveDriver(desc, {
      driver: options.drivers?.[ns] ?? options.driver,
    })
    const storage = createStorage({ driver })
    const defaults = { ...(desc.default ?? {}) }
    const resource = desc.resource === true
    nsStates[ns] = {
      ns,
      storage,
      mount: desc.mount,
      defaults,
      lastKnown: resource ? { [RESOURCE_STORAGE_KEY]: null } : { ...defaults },
      resource,
    }
    storagesMap[ns] = storage
  }

  const seed: Record<string, unknown> = {}
  for (const [ns, state] of Object.entries(nsStates)) {
    // Resource namespaces seed as null until hydrate fills `kv.<ns>`.
    seed[ns] = state.resource ? null : { ...state.defaults }
  }

  let applyingExternal = false
  let disposed = false

  const persistNs = async (state: NsState, key: string, value: unknown): Promise<boolean> => {
    try {
      const full = state.resource ? RESOURCE_STORAGE_KEY : storageKey(state.mount, key)
      await state.storage.setItem(full, value as string)
      state.lastKnown[key] = value
      return true
    } catch (err) {
      const label = state.resource ? state.ns : `${state.mount}:${key}`
      console.warn(
        `[comark-kv] Failed to persist "${label}": ${err instanceof Error ? err.message : String(err)}`,
      )
      return false
    }
  }

  const model = createModelStore({
    data: {
      ...(options.data ?? {}),
      [KV_NAMESPACE]: seed,
    },
    writable: [KV_NAMESPACE, ...(options.writable ?? [])],
    documentKey: options.documentKey,
    onChange: (path, value, next) => {
      options.onChange?.(path, value, next)
      if (applyingExternal || disposed) return

      // path = 'kv.<ns>' (resource) or 'kv.<ns>.<key>' / 'kv.<ns>.…' (nested)
      const segments = path.split('.')
      if (segments[0] !== KV_NAMESPACE || segments.length < 2) return
      const ns = segments[1]!
      const state = nsStates[ns]
      if (!state) return

      if (state.resource) {
        // Only persist whole-resource replaces (`kv.<ns>`). Nested edits
        // (e.g. toggling `kv.todos.0.completed`) stay in the model locally —
        // PUT-ing an entire remote collection on every field write is rarely valid.
        if (segments.length !== 2) return

        const rootPath = `${KV_NAMESPACE}.${ns}`
        const previous = state.lastKnown[RESOURCE_STORAGE_KEY]
        void persistNs(state, RESOURCE_STORAGE_KEY, value).then((ok) => {
          if (ok || disposed) return
          applyingExternal = true
          try {
            model.set(rootPath, previous)
          } finally {
            applyingExternal = false
          }
        })
        return
      }

      if (segments.length < 3) return
      const key = segments.slice(2).join('.')
      const previous = state.lastKnown[key]
      void persistNs(state, key, value).then((ok) => {
        if (ok || disposed) return
        applyingExternal = true
        try {
          model.set(path, previous)
        } finally {
          applyingExternal = false
        }
      })
    },
  })

  const hydrateResource = async (state: NsState): Promise<void> => {
    let stored: unknown
    try {
      stored = await state.storage.getItem(RESOURCE_STORAGE_KEY)
    } catch (err) {
      console.warn(
        `[comark-kv] Failed to read resource "${state.ns}": ${err instanceof Error ? err.message : String(err)}`,
      )
      return
    }
    if (stored === null || stored === undefined) return
    state.lastKnown[RESOURCE_STORAGE_KEY] = stored
    model.set(`${KV_NAMESPACE}.${state.ns}`, stored)
  }

  const hydrateNs = async (state: NsState): Promise<void> => {
    if (state.resource) {
      await hydrateResource(state)
      return
    }

    const keys = Object.keys(state.defaults)
    if (keys.length === 0) return

    for (const key of keys) {
      if (disposed) return
      const full = storageKey(state.mount, key)
      let stored: unknown
      try {
        stored = await state.storage.getItem(full)
      } catch (err) {
        console.warn(
          `[comark-kv] Failed to read "${full}": ${err instanceof Error ? err.message : String(err)}`,
        )
        continue
      }

      if (stored === null || stored === undefined) {
        await persistNs(state, key, state.defaults[key])
      } else {
        state.lastKnown[key] = stored
        model.set(`${KV_NAMESPACE}.${state.ns}.${key}`, stored)
      }
    }
  }

  const watchNs = async (state: NsState): Promise<void> => {
    try {
      state.unwatch = await state.storage.watch(async (_event, fullKey) => {
        if (disposed || applyingExternal) return

        if (state.resource) {
          let stored: unknown
          try {
            stored = await state.storage.getItem(RESOURCE_STORAGE_KEY)
          } catch {
            return
          }
          applyingExternal = true
          try {
            state.lastKnown[RESOURCE_STORAGE_KEY] = stored
            model.set(`${KV_NAMESPACE}.${state.ns}`, stored)
          } finally {
            applyingExternal = false
          }
          return
        }

        const key = keyFromStorageKey(state.mount, fullKey)
        if (key === null) return

        let stored: unknown
        try {
          stored = await state.storage.getItem(fullKey)
        } catch {
          return
        }

        applyingExternal = true
        try {
          const value =
            stored === null || stored === undefined ? state.defaults[key] : stored
          state.lastKnown[key] = value
          model.set(`${KV_NAMESPACE}.${state.ns}.${key}`, value)
        } finally {
          applyingExternal = false
        }
      })
    } catch {
      // Drivers without watch support are fine.
    }
  }

  const ready = (async () => {
    applyingExternal = true
    try {
      await Promise.all(Object.values(nsStates).map(hydrateNs))
    } finally {
      applyingExternal = false
    }

    if (disposed) return
    await Promise.all(Object.values(nsStates).map(watchNs))
  })()

  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const state of Object.values(nsStates)) {
      const fn = state.unwatch
      state.unwatch = undefined
      if (fn) void Promise.resolve(fn()).catch(() => {})
    }
  }

  const firstStorage = Object.values(storagesMap)[0]!
  return { model, ready, dispose, storage: firstStorage, storages: storagesMap }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Create a {@link ComarkModel} backed by unstorage for the given {@link KvSchema}.
 *
 * - Single-driver `KvDescriptor`: seeds `kv.*`, persists changes, watches storage.
 * - Multi-driver `KvNamespaceMap`: seeds `kv.<ns>.*` for every namespace,
 *   persists to each namespace's storage independently.
 */
export const createKvModel = async (
  schema: KvSchema,
  options: CreateKvModelOptions = {},
): Promise<KvModelHandle> => {
  if (isSingleDriverSchema(schema)) {
    return createSingleDriver(schema, options)
  }
  return createMultiDriver(schema as Record<string, KvDescriptor>, options)
}
