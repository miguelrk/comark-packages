import type { Driver } from 'unstorage'
import type { KvDescriptor } from '../types.ts'

export interface ResolveDriverOptions {
  /** Inject a custom unstorage driver instance (skips name lookup). */
  driver?: Driver
}

/**
 * Resolve an unstorage {@link Driver} from a {@link KvDescriptor}.
 *
 * Built-in aliases:
 * - `browser` → `localstorage`
 * - `memory` → `memory`
 * - `http` → `http` (requires `base`)
 */
export const resolveDriver = async (
  descriptor: KvDescriptor,
  options: ResolveDriverOptions = {},
): Promise<Driver> => {
  if (options.driver) return options.driver

  const name = descriptor.driver

  if (name === 'browser' || name === 'localstorage') {
    const { default: localstorage } = await import('unstorage/drivers/localstorage')
    // Pass `window` so watch() registers the `storage` event (cross-tab sync).
    // Without it, get/set still work via globalThis.window, but watch is a no-op.
    const win = typeof globalThis !== 'undefined' ? (globalThis as typeof globalThis & { window?: Window }).window : undefined
    if (!win?.localStorage) {
      throw new Error(
        `[comark-kv] Driver "${name}" requires browser localStorage. Create the model on the client only.`,
      )
    }
    return localstorage({ window: win, localStorage: win.localStorage })
  }

  if (name === 'memory') {
    const { default: memory } = await import('unstorage/drivers/memory')
    return memory()
  }

  if (name === 'http') {
    const { default: http } = await import('unstorage/drivers/http')
    return http({ base: descriptor.base ?? '' })
  }

  if (name === 'session-storage' || name === 'sessionStorage') {
    const { default: sessionStorageDriver } = await import('unstorage/drivers/session-storage')
    const win = typeof globalThis !== 'undefined' ? (globalThis as typeof globalThis & { window?: Window }).window : undefined
    if (!win?.sessionStorage) {
      throw new Error(
        `[comark-kv] Driver "${name}" requires browser sessionStorage. Create the model on the client only.`,
      )
    }
    return sessionStorageDriver({ window: win })
  }

  if (name === 'indexedb') {
    const { default: indexedb } = await import('unstorage/drivers/indexedb')
    return indexedb({})
  }

  throw new Error(`[comark-kv] Unsupported driver "${name}". Pass options.driver to inject a custom unstorage driver.`)
}

export const storageKey = (mount: string, key: string): string => `${mount}:${key}`

export const keyFromStorageKey = (mount: string, fullKey: string): string | null => {
  const prefix = `${mount}:`
  if (!fullKey.startsWith(prefix)) return null
  const key = fullKey.slice(prefix.length)
  return key.length > 0 ? key : null
}
