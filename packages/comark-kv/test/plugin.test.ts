import { parseMarkdown } from 'comark'
import { describe, expect, it } from 'vitest'
import kv, {
  assertNoDuplicateKvDefaultKeys,
  findDuplicateKvDefaultKeys,
  isSingleDriverSchema,
  normalizeKv,
  validateKv,
} from '../src/index.ts'

describe('normalize / validate — single-driver', () => {
  it('applies mount default of "kv"', () => {
    const desc = normalizeKv({ driver: 'memory' })
    expect(desc).toEqual({ driver: 'memory', mount: 'kv' })
  })

  it('preserves mount, base, and default', () => {
    const desc = normalizeKv({
      driver: 'http',
      mount: 'prefs',
      base: '/api/kv',
      default: { name: 'Ada' },
    })
    expect(desc).toEqual({
      driver: 'http',
      mount: 'prefs',
      base: '/api/kv',
      default: { name: 'Ada' },
    })
  })

  it('returns null for non-objects', () => {
    expect(normalizeKv(null)).toBeNull()
    expect(normalizeKv('x')).toBeNull()
  })

  it('requires driver', () => {
    const result = validateKv({ driver: '', mount: 'kv' })
    expect(result.ok).toBe(false)
    expect(result.errors['driver']).toBeDefined()
  })

  it('requires base for http driver', () => {
    const result = validateKv({ driver: 'http', mount: 'prefs' })
    expect(result.ok).toBe(false)
    expect(result.errors['base']).toBeDefined()
  })

  it('accepts a valid memory descriptor', () => {
    const result = validateKv({
      driver: 'memory',
      mount: 'prefs',
      default: { name: 'Ada' },
    })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('isSingleDriverSchema returns true for KvDescriptor', () => {
    expect(isSingleDriverSchema({ driver: 'memory', mount: 'kv' })).toBe(true)
  })
})

describe('normalize / validate — multi-driver', () => {
  it('normalizes a two-namespace map', () => {
    const schema = normalizeKv({
      local: { driver: 'browser', mount: 'prefs', default: { name: 'Ada' } },
      session: { driver: 'memory', mount: 'ui', default: { draft: '' } },
    })
    expect(schema).toEqual({
      local: { driver: 'browser', mount: 'prefs', default: { name: 'Ada' } },
      session: { driver: 'memory', mount: 'ui', default: { draft: '' } },
    })
  })

  it('applies mount default per namespace', () => {
    const schema = normalizeKv({
      a: { driver: 'memory' },
      b: { driver: 'memory', mount: 'custom' },
    })
    expect(schema).toEqual({
      a: { driver: 'memory', mount: 'kv' },
      b: { driver: 'memory', mount: 'custom' },
    })
  })

  it('returns null for empty object', () => {
    expect(normalizeKv({})).toBeNull()
  })

  it('isSingleDriverSchema returns false for namespace map', () => {
    const schema = normalizeKv({ local: { driver: 'memory', mount: 'kv' } })!
    expect(isSingleDriverSchema(schema)).toBe(false)
  })

  it('validates ok for a valid multi-driver map', () => {
    const schema = normalizeKv({
      local: { driver: 'memory', mount: 'prefs' },
      session: { driver: 'memory', mount: 'ui' },
    })!
    const result = validateKv(schema)
    expect(result.ok).toBe(true)
  })

  it('prefixes errors with namespace name', () => {
    const schema = normalizeKv({
      remote: { driver: 'http', mount: 'api' },
    })!
    const result = validateKv(schema)
    expect(result.ok).toBe(false)
    expect(result.errors['remote.base']).toBeDefined()
  })

  it('returns error for empty map', () => {
    // normalizeKv returns null for empty, so test validateKv directly
    const result = validateKv({} as Record<string, never>)
    expect(result.ok).toBe(false)
    expect(result.errors['kv']).toBeDefined()
  })

  it('expands an http URL shortcut to a resource descriptor', () => {
    const schema = normalizeKv({
      local: { driver: 'memory', mount: 'prefs' },
      posts: 'https://jsonplaceholder.typicode.com/posts?_limit=5',
    })
    expect(schema).toEqual({
      local: { driver: 'memory', mount: 'prefs' },
      posts: {
        driver: 'http',
        mount: 'posts',
        base: 'https://jsonplaceholder.typicode.com/posts?_limit=5',
        resource: true,
      },
    })
  })

  it('expands a relative path shortcut to http resource', () => {
    const schema = normalizeKv({
      api: '/api/kv',
    })
    expect(schema).toEqual({
      api: { driver: 'http', mount: 'api', base: '/api/kv', resource: true },
    })
  })

  it('validates http URL shortcut as ok', () => {
    const schema = normalizeKv({
      posts: 'https://jsonplaceholder.typicode.com/posts?_limit=5',
    })!
    expect(validateKv(schema).ok).toBe(true)
  })

  it('rejects non-url strings in multi-driver map', () => {
    expect(normalizeKv({ posts: 'not-a-url' })).toBeNull()
  })
})

describe('duplicate kv.default keys', () => {
  it('finds duplicates under kv.default (single-driver)', () => {
    const md = `---
kv:
  driver: memory
  default:
    name: Ada
    name: Bob
---
`
    expect(findDuplicateKvDefaultKeys(md)).toEqual(['name'])
  })

  it('throws via assert helper', () => {
    const md = `---
kv:
  driver: memory
  default:
    a: 1
    a: 2
---
`
    expect(() => assertNoDuplicateKvDefaultKeys(md)).toThrow(/Duplicate key/)
  })

  it('does not flag the same key in different namespace default sections', () => {
    const md = `---
kv:
  local:
    driver: memory
    default:
      name: Ada
  session:
    driver: memory
    default:
      name: Bob
---
`
    expect(findDuplicateKvDefaultKeys(md)).toEqual([])
  })
})

describe('comark-kv (parse-time) — single-driver', () => {
  it('writes normalized descriptor to meta.kv', async () => {
    const tree = await parseMarkdown(
      `---
kv:
  driver: memory
  mount: prefs
  default:
    name: Ada
    subscribed: false
---

# Hello
`,
      { plugins: [kv()] },
    )

    expect(tree.meta.kv).toEqual({
      driver: 'memory',
      mount: 'prefs',
      default: { name: 'Ada', subscribed: false },
    })
    expect(tree.meta.kvErrors).toBeUndefined()
  })

  it('defaults mount to "kv"', async () => {
    const tree = await parseMarkdown(
      `---
kv:
  driver: memory
---
`,
      { plugins: [kv()] },
    )
    expect((tree.meta.kv as { mount: string }).mount).toBe('kv')
  })

  it('records validation errors in meta.kvErrors', async () => {
    const tree = await parseMarkdown(
      `---
kv:
  driver: http
  mount: prefs
---
`,
      { plugins: [kv()] },
    )
    expect(tree.meta.kv).toBeUndefined()
    expect(tree.meta.kvErrors?.['base']).toBeDefined()
  })

  it('rejects duplicate kv.default keys', async () => {
    await expect(
      parseMarkdown(
        `---
kv:
  driver: memory
  default:
    name: Ada
    name: Bob
---
`,
        { plugins: [kv()] },
      ),
    ).rejects.toThrow(/Duplicate key|duplicated mapping key/)
  })

  it('can be disabled', async () => {
    const tree = await parseMarkdown(
      `---
kv:
  driver: memory
---
`,
      { plugins: [kv({ enabled: false })] },
    )
    expect(tree.meta.kv).toBeUndefined()
  })

  it('skips when kv frontmatter is absent', async () => {
    const tree = await parseMarkdown('# Hello', { plugins: [kv()] })
    expect(tree.meta.kv).toBeUndefined()
    expect(tree.meta.kvErrors).toBeUndefined()
  })
})

describe('comark-kv (parse-time) — multi-driver', () => {
  it('writes normalized namespace map to meta.kv', async () => {
    const tree = await parseMarkdown(
      `---
kv:
  local:
    driver: memory
    mount: prefs
    default:
      name: Ada
  session:
    driver: memory
    mount: ui
    default:
      draft: ""
---
`,
      { plugins: [kv()] },
    )

    expect(tree.meta.kv).toEqual({
      local: { driver: 'memory', mount: 'prefs', default: { name: 'Ada' } },
      session: { driver: 'memory', mount: 'ui', default: { draft: '' } },
    })
    expect(tree.meta.kvErrors).toBeUndefined()
    expect(isSingleDriverSchema(tree.meta.kv!)).toBe(false)
  })

  it('records per-namespace validation errors', async () => {
    const tree = await parseMarkdown(
      `---
kv:
  remote:
    driver: http
    mount: api
---
`,
      { plugins: [kv()] },
    )
    expect(tree.meta.kv).toBeUndefined()
    expect(tree.meta.kvErrors?.['remote.base']).toBeDefined()
  })

  it('applies mount default per namespace', async () => {
    const tree = await parseMarkdown(
      `---
kv:
  a:
    driver: memory
  b:
    driver: memory
    mount: custom
---
`,
      { plugins: [kv()] },
    )
    expect((tree.meta.kv as Record<string, { mount: string }>)['a']?.mount).toBe('kv')
    expect((tree.meta.kv as Record<string, { mount: string }>)['b']?.mount).toBe('custom')
  })

  it('expands http URL shortcut in frontmatter', async () => {
    const tree = await parseMarkdown(
      `---
kv:
  local:
    driver: memory
    mount: prefs
    default:
      name: Ada
  posts: https://jsonplaceholder.typicode.com/posts?_limit=5
---
`,
      { plugins: [kv()] },
    )
    expect(tree.meta.kv).toEqual({
      local: { driver: 'memory', mount: 'prefs', default: { name: 'Ada' } },
      posts: {
        driver: 'http',
        mount: 'posts',
        base: 'https://jsonplaceholder.typicode.com/posts?_limit=5',
        resource: true,
      },
    })
  })
})
