import { parseMarkdown } from 'comark'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fetchPlugin, {
  findDuplicateFetchKeys,
  FetchCache,
  normalizeEntry,
  resetDefaultFetchCache,
  validateEntry,
} from '../src/index.ts'

afterEach(() => {
  resetDefaultFetchCache()
  vi.restoreAllMocks()
})

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

describe('normalize / validate', () => {
  it('expands shorthand string to GET fetch', () => {
    expect(normalizeEntry('https://example.com/posts')).toEqual({
      url: 'https://example.com/posts',
      method: 'GET',
    })
  })

  it('rejects relative and non-http URLs', () => {
    expect(validateEntry('a', { url: '/rel' }).ok).toBe(false)
    expect(validateEntry('b', { url: 's3://bucket/key' }).ok).toBe(false)
    expect(validateEntry('c', { url: 'ws://example.com' }).ok).toBe(false)
  })
})

describe('duplicate fetch keys', () => {
  it('detects duplicate keys under fetch:', () => {
    const md = `---
fetch:
  posts: https://a.com/1
  posts: https://a.com/2
---
# Hi
`
    expect(findDuplicateFetchKeys(md)).toEqual(['posts'])
  })

  it('rejects duplicate keys at parse time', async () => {
    const md = `---
fetch:
  posts: https://jsonplaceholder.typicode.com/posts
  posts: https://jsonplaceholder.typicode.com/posts/1
---
# Hi
`
    await expect(
      parseMarkdown(md, {
        plugins: [fetchPlugin({ allowOrigins: ['*'], fetch: vi.fn() })],
      }),
    ).rejects.toThrow(/duplicated mapping key|Duplicate key/)
  })
})

describe('comark-fetch (parse-time)', () => {
  it('does nothing when fetch: is absent', async () => {
    const tree = await parseMarkdown('# Hello', {
      plugins: [fetchPlugin({ allowOrigins: ['*'] })],
    })
    expect(tree.meta.fetch).toBeUndefined()
    expect(tree.meta.fetchErrors).toBeUndefined()
  })

  it('resolves shorthand into meta.fetch', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([{ id: 1 }]))
    const tree = await parseMarkdown(
      `---
fetch:
  posts: https://api.example.com/posts
---
# Posts
`,
      {
        plugins: [fetchPlugin({ allowOrigins: ['https://api.example.com'], fetch: fetchImpl })],
      },
    )
    expect(tree.meta.fetch?.posts).toEqual([{ id: 1 }])
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('supports full object with method/headers/body', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json')
      expect(init?.body).toBe('{"q":1}')
      return jsonResponse({ ok: true })
    })

    const tree = await parseMarkdown(
      `---
fetch:
  search:
    url: https://api.example.com/search
    method: POST
    headers:
      content-type: application/json
    body: '{"q":1}'
---
# Search
`,
      {
        plugins: [fetchPlugin({ allowOrigins: ['https://api.example.com'], fetch: fetchImpl })],
      },
    )
    expect(tree.meta.fetch?.search).toEqual({ ok: true })
  })

  it('records HTTP errors in fetchErrors', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'nope' }, 500))
    const tree = await parseMarkdown(
      `---
fetch:
  posts: https://api.example.com/posts
---
# Posts
`,
      {
        plugins: [fetchPlugin({ allowOrigins: ['*'], fetch: fetchImpl })],
      },
    )
    expect(tree.meta.fetch?.posts).toBeUndefined()
    expect(tree.meta.fetchErrors?.posts?.message).toMatch(/HTTP 500/)
  })

  it('allows requests when a custom fetch is supplied (even with empty allowlist)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]))
    const tree = await parseMarkdown(
      `---
fetch:
  posts: https://api.example.com/posts
---
# Posts
`,
      { plugins: [fetchPlugin({ fetch: fetchImpl })] },
    )
    expect(tree.meta.fetch?.posts).toEqual([])
  })

  it('denies origins without custom fetch', async () => {
    const tree = await parseMarkdown(
      `---
fetch:
  posts: https://api.example.com/posts
---
# Posts
`,
      { plugins: [fetchPlugin({ allowOrigins: [] })] },
    )
    expect(tree.meta.fetchErrors?.posts?.message).toMatch(/Origin not allowed/)
  })

  it('allows any origin with allowOrigins: ["*"]', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ a: 1 }))
    const tree = await parseMarkdown(
      `---
fetch:
  x: https://other.example.com/x
---
# X
`,
      { plugins: [fetchPlugin({ allowOrigins: ['*'], fetch: fetchImpl })] },
    )
    expect(tree.meta.fetch?.x).toEqual({ a: 1 })
  })

  it('reuses an injected cache when staleTime is fresh', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ n: 1 }))
    const cache = new FetchCache({ defaultStaleTime: Infinity })

    const md = `---
fetch:
  posts: https://api.example.com/posts
---
# Posts
`

    await parseMarkdown(md, {
      plugins: [fetchPlugin({ allowOrigins: ['*'], fetch: fetchImpl, cache })],
    })
    await parseMarkdown(md, {
      plugins: [fetchPlugin({ allowOrigins: ['*'], fetch: fetchImpl, cache })],
    })

    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('skips when plugin enabled is false', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]))
    const tree = await parseMarkdown(
      `---
fetch:
  posts: https://api.example.com/posts
---
# Posts
`,
      { plugins: [fetchPlugin({ enabled: false, allowOrigins: ['*'], fetch: fetchImpl })] },
    )
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(tree.meta.fetch).toBeUndefined()
  })

  it('skips a single entry with enabled: false', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }))
    const tree = await parseMarkdown(
      `---
fetch:
  off:
    url: https://api.example.com/off
    enabled: false
  on: https://api.example.com/on
---
# Mixed
`,
      { plugins: [fetchPlugin({ allowOrigins: ['*'], fetch: fetchImpl })] },
    )
    expect(tree.meta.fetch?.on).toEqual({ ok: true })
    expect(tree.meta.fetch?.off).toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('throwOnError rejects the parse', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 404))
    await expect(
      parseMarkdown(
        `---
fetch:
  posts: https://api.example.com/posts
---
# Posts
`,
        {
          plugins: [fetchPlugin({ allowOrigins: ['*'], fetch: fetchImpl, throwOnError: true })],
        },
      ),
    ).rejects.toThrow(/HTTP 404/)
  })
})
