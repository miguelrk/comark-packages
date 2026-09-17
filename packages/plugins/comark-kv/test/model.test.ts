import { describe, expect, it, vi } from 'vitest'
import { createStorage } from 'unstorage'
import memory from 'unstorage/drivers/memory'
import { createKvModel } from '../src/model/index.ts'

describe('createKvModel — single-driver', () => {
  it('seeds model with defaults synchronously', async () => {
    const { model, ready, dispose } = await createKvModel({
      driver: 'memory',
      mount: 'prefs',
      default: { name: 'Ada', subscribed: false },
    })
    expect(model.get('kv.name')).toBe('Ada')
    expect(model.get('kv.subscribed')).toBe(false)
    await ready
    dispose()
  })

  it('persists local writes to storage', async () => {
    const { model, ready, dispose, storage } = await createKvModel({
      driver: 'memory',
      mount: 'prefs',
      default: { name: 'Ada' },
    })
    await ready

    expect(model.set('kv.name', 'Bob')).toBe(true)
    await vi.waitFor(async () => {
      expect(await storage.getItem('prefs:name')).toBe('Bob')
    })

    dispose()
  })

  it('persists local writes through an injected localStorage driver', async () => {
    const store = new Map<string, string>()
    const fakeLocalStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size
      },
    }
    const storageObj = new Proxy(fakeLocalStorage as Storage, {
      ownKeys: () => [...store.keys()],
      getOwnPropertyDescriptor: (_target, prop) => {
        if (typeof prop === 'string' && store.has(prop)) {
          return { configurable: true, enumerable: true, value: store.get(prop) }
        }
        return undefined
      },
    })

    const { default: localstorage } = await import('unstorage/drivers/localstorage')
    const { model, ready, dispose, storage } = await createKvModel(
      {
        driver: 'browser',
        mount: 'prefs',
        default: { name: 'Ada' },
      },
      { driver: localstorage({ localStorage: storageObj }) },
    )
    await ready

    expect(model.set('kv.name', 'Bob')).toBe(true)
    await vi.waitFor(async () => {
      expect(await storage.getItem('prefs:name')).toBe('Bob')
    })

    dispose()
  })

  it('hydrates from existing storage values over defaults', async () => {
    const shared = createStorage({ driver: memory() })
    await shared.setItem('prefs:name', 'Carol')

    const { model, ready, dispose } = await createKvModel(
      {
        driver: 'memory',
        mount: 'prefs',
        default: { name: 'Ada' },
      },
      { driver: shared.getMount('').driver },
    )
    await ready

    expect(model.get('kv.name')).toBe('Carol')
    dispose()
  })

  it('persists defaults when storage key is absent', async () => {
    const { ready, dispose, storage } = await createKvModel({
      driver: 'memory',
      mount: 'prefs',
      default: { name: 'Ada' },
    })
    await ready

    expect(await storage.getItem('prefs:name')).toBe('Ada')
    dispose()
  })

  it('applies external storage writes via watch', async () => {
    const { model, ready, dispose, storage } = await createKvModel({
      driver: 'memory',
      mount: 'prefs',
      default: { name: 'Ada' },
    })
    await ready

    const seen: unknown[] = []
    const unsub = model.subscribe('kv.name', (v) => seen.push(v))

    await storage.setItem('prefs:name', 'Eve')
    await vi.waitFor(() => {
      expect(model.get('kv.name')).toBe('Eve')
    })

    unsub()
    dispose()
  })

  it('rolls back the model when persistence fails', async () => {
    const base = memory()
    const failingDriver = {
      ...base,
      setItem: async () => {
        throw new Error('disk full')
      },
    }

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { model, ready, dispose } = await createKvModel(
      {
        driver: 'memory',
        mount: 'prefs',
        default: { name: 'Ada' },
      },
      { driver: failingDriver },
    )
    await ready

    expect(model.set('kv.name', 'Bob')).toBe(true)
    await vi.waitFor(() => {
      expect(model.get('kv.name')).toBe('Ada')
    })

    warn.mockRestore()
    dispose()
  })

  it('rejects writes outside the kv namespace', async () => {
    const { model, ready, dispose } = await createKvModel({
      driver: 'memory',
      mount: 'prefs',
      default: { name: 'Ada' },
    })
    await ready

    expect(model.set('data.name', 'x')).toBe(false)
    dispose()
  })

  it('dispose is idempotent', async () => {
    const { ready, dispose } = await createKvModel({
      driver: 'memory',
      mount: 'prefs',
      default: { name: 'Ada' },
    })
    await ready
    dispose()
    dispose()
  })

  it('storages map contains "kv" key for single-driver', async () => {
    const { ready, dispose, storages, storage } = await createKvModel({
      driver: 'memory',
      mount: 'prefs',
      default: { name: 'Ada' },
    })
    await ready
    expect(storages['kv']).toBe(storage)
    dispose()
  })
})

describe('createKvModel — multi-driver', () => {
  it('seeds each namespace with its defaults synchronously', async () => {
    const { model, ready, dispose } = await createKvModel({
      local: { driver: 'memory', mount: 'prefs', default: { name: 'Ada' } },
      session: { driver: 'memory', mount: 'ui', default: { draft: '' } },
    })
    expect(model.get('kv.local.name')).toBe('Ada')
    expect(model.get('kv.session.draft')).toBe('')
    await ready
    dispose()
  })

  it('persists writes to the correct namespace storage', async () => {
    const { model, ready, dispose, storages } = await createKvModel({
      local: { driver: 'memory', mount: 'prefs', default: { name: 'Ada' } },
      session: { driver: 'memory', mount: 'ui', default: { draft: '' } },
    })
    await ready

    expect(model.set('kv.local.name', 'Bob')).toBe(true)
    await vi.waitFor(async () => {
      expect(await storages['local']!.getItem('prefs:name')).toBe('Bob')
    })
    expect(await storages['session']!.getItem('ui:draft')).toBe('')

    dispose()
  })

  it('hydrates each namespace from its storage over defaults', async () => {
    const localStore = createStorage({ driver: memory() })
    const sessionStore = createStorage({ driver: memory() })
    await localStore.setItem('prefs:name', 'Carol')
    await sessionStore.setItem('ui:draft', 'hello')

    const { model, ready, dispose } = await createKvModel(
      {
        local: { driver: 'memory', mount: 'prefs', default: { name: 'Ada' } },
        session: { driver: 'memory', mount: 'ui', default: { draft: '' } },
      },
      {
        drivers: {
          local: localStore.getMount('').driver,
          session: sessionStore.getMount('').driver,
        },
      },
    )
    await ready

    expect(model.get('kv.local.name')).toBe('Carol')
    expect(model.get('kv.session.draft')).toBe('hello')
    dispose()
  })

  it('applies external writes to the correct namespace via watch', async () => {
    const { model, ready, dispose, storages } = await createKvModel({
      local: { driver: 'memory', mount: 'prefs', default: { name: 'Ada' } },
    })
    await ready

    await storages['local']!.setItem('prefs:name', 'Eve')
    await vi.waitFor(() => {
      expect(model.get('kv.local.name')).toBe('Eve')
    })

    dispose()
  })

  it('rolls back only the affected namespace on persistence failure', async () => {
    const base = memory()
    const failingDriver = {
      ...base,
      setItem: async () => {
        throw new Error('disk full')
      },
    }

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { model, ready, dispose } = await createKvModel(
      {
        local: { driver: 'memory', mount: 'prefs', default: { name: 'Ada' } },
        session: { driver: 'memory', mount: 'ui', default: { draft: '' } },
      },
      { drivers: { local: failingDriver } },
    )
    await ready

    expect(model.set('kv.local.name', 'Bob')).toBe(true)
    await vi.waitFor(() => {
      expect(model.get('kv.local.name')).toBe('Ada')
    })
    // session is unaffected
    expect(model.get('kv.session.draft')).toBe('')

    warn.mockRestore()
    dispose()
  })

  it('storages map is keyed by namespace name', async () => {
    const { ready, dispose, storages } = await createKvModel({
      local: { driver: 'memory', mount: 'prefs', default: { name: 'Ada' } },
      session: { driver: 'memory', mount: 'ui', default: { draft: '' } },
    })
    await ready
    expect(Object.keys(storages).sort()).toEqual(['local', 'session'])
    dispose()
  })

  it('dispose is idempotent for multi-driver', async () => {
    const { ready, dispose } = await createKvModel({
      local: { driver: 'memory', mount: 'prefs', default: { name: 'Ada' } },
    })
    await ready
    dispose()
    dispose()
  })

  it('hydrates an http resource namespace from base URL (empty key)', async () => {
    const posts = [
      { id: 1, title: 'First' },
      { id: 2, title: 'Second' },
    ]
    const resourceDriver = {
      ...memory(),
      getItem: async (key: string) => {
        // resource hydrate uses empty storage key
        if (key === '' || key === '/') return posts
        return null
      },
    }

    const { model, ready, dispose } = await createKvModel(
      {
        posts: {
          driver: 'http',
          mount: 'posts',
          base: 'https://example.com/posts',
          resource: true,
        },
      },
      { drivers: { posts: resourceDriver } },
    )
    await ready

    expect(model.get('kv.posts')).toEqual(posts)
    expect(model.get('kv.posts.0.title')).toBe('First')
    dispose()
  })

  it('keeps nested resource edits in the model without persisting', async () => {
    const posts = [
      { id: 1, title: 'First', completed: false },
      { id: 2, title: 'Second', completed: true },
    ]
    let setCount = 0
    const resourceDriver = {
      ...memory(),
      getItem: async (key: string) => {
        if (key === '' || key === '/') return posts
        return null
      },
      setItem: async () => {
        setCount += 1
      },
    }

    const { model, ready, dispose } = await createKvModel(
      {
        todos: {
          driver: 'http',
          mount: 'todos',
          base: 'https://example.com/todos',
          resource: true,
        },
      },
      { drivers: { todos: resourceDriver } },
    )
    await ready

    expect(model.set('kv.todos.0.completed', true)).toBe(true)
    expect(model.get('kv.todos.0.completed')).toBe(true)
    // Nested edits must not trigger a whole-resource persist.
    expect(setCount).toBe(0)

    dispose()
  })
})
