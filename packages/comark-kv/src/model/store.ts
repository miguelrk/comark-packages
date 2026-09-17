/**
 * ComarkModel protocol + store.
 *
 * `comark@0.7.0` does not export `comark/model`. Keep this copy until that
 * subpath ships, then switch the public imports back.
 */

export interface ComarkModel {
  get(path: string): unknown
  set(path: string, value: unknown): boolean
  subscribe(path: string, fn: (value: unknown) => void): () => void
  batch?<T>(fn: () => T): T
}

export interface ModelStoreOptions {
  data?: Record<string, unknown>
  writable?: readonly string[]
  onChange?: (path: string, value: unknown, next: Record<string, unknown>) => void
  documentKey?: string
}

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype', ''])

const get = (data: unknown, key: string): unknown => {
  let value: unknown = data
  for (const k of key.split('.')) {
    if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[k]
    } else {
      return undefined
    }
  }
  return value
}

const set = (data: Record<string, unknown>, key: string, value: unknown): boolean => {
  const keys = key.split('.')
  if (keys.some(k => FORBIDDEN.has(k))) return false

  let cursor: Record<string, unknown> = data
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!
    const next = cursor[k]
    if (next === null || typeof next !== 'object') {
      const obj: Record<string, unknown> = {}
      cursor[k] = obj
      cursor = obj
    } else {
      cursor = next as Record<string, unknown>
    }
  }

  cursor[keys[keys.length - 1]!] = value
  return true
}

type ComarkContextHost = {
  get: (key: string) => { patch: (patch: { op: 'data', data: Record<string, unknown> }) => void }
}

export const createModelStore = (options: ModelStoreOptions = {}): ComarkModel => {
  const writable = new Set(options.writable ?? ['data'])
  const incoming = options.data ?? {}
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(incoming)) {
    const value = incoming[key]
    data[key] =
      value !== null && typeof value === 'object' && !Array.isArray(value)
        ? { ...(value as Record<string, unknown>) }
        : value
  }

  const listeners = new Map<string, Set<(value: unknown) => void>>()

  let batching = false
  const pendingNotifications = new Map<string, unknown>()

  const notify = (path: string, value: unknown) => {
    const segments = path.split('.')
    if (batching) {
      for (let i = segments.length; i >= 1; i--) {
        const ancestor = segments.slice(0, i).join('.')
        pendingNotifications.set(ancestor, i === segments.length ? value : get(data, ancestor))
      }
      return
    }
    for (let i = segments.length; i >= 1; i--) {
      const ancestor = segments.slice(0, i).join('.')
      const fns = listeners.get(ancestor)
      if (!fns) continue
      const ancestorValue = i === segments.length ? value : get(data, ancestor)
      for (const fn of fns) fn(ancestorValue)
    }
  }

  const flushBatch = () => {
    for (const [p, v] of pendingNotifications) {
      const fns = listeners.get(p)
      if (fns) for (const fn of fns) fn(v)
    }
    pendingNotifications.clear()
  }

  const model: ComarkModel = {
    get(path) {
      return get(data, path)
    },

    set(path, value) {
      const namespace = path.split('.')[0]
      if (!namespace || !writable.has(namespace)) return false
      const ok = set(data, path, value)
      if (!ok) return false

      if (options.documentKey) {
        const host = (globalThis as { comarkContext?: ComarkContextHost }).comarkContext
        if (host) {
          const payload =
            typeof data.data === 'object' && data.data !== null && !Array.isArray(data.data)
              ? { ...(data.data as Record<string, unknown>) }
              : { ...data }
          host.get(options.documentKey).patch({ op: 'data', data: payload })
        }
      }

      notify(path, value)
      options.onChange?.(path, value, data)
      return true
    },

    subscribe(path, fn) {
      let fns = listeners.get(path)
      if (!fns) {
        fns = new Set()
        listeners.set(path, fns)
      }
      fns.add(fn)
      return () => {
        fns!.delete(fn)
        if (fns!.size === 0) listeners.delete(path)
      }
    },

    batch(fn) {
      batching = true
      try {
        return fn()
      } finally {
        batching = false
        flushBatch()
      }
    },
  }

  return model
}
