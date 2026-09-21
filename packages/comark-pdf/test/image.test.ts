import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderPdf } from '../src/index.ts'
import { IMAGE_FETCH_MAX_BYTES, resolveImageSrc } from '../src/image.ts'

const isPdf = (bytes: Uint8Array) =>
  Buffer.from(bytes.slice(0, 4)).toString('ascii') === '%PDF'

const PNG_1X1_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PNG_1X1 = Uint8Array.from(Buffer.from(PNG_1X1_B64, 'base64'))
const DATA_URI = `data:image/png;base64,${PNG_1X1_B64}`

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('resolveImageSrc', () => {
  it('decodes a data URI', async () => {
    const resolved = await resolveImageSrc(DATA_URI)
    expect(resolved.kind).toBe('bytes')
    if (resolved.kind === 'bytes') expect(resolved.bytes.length).toBe(PNG_1X1.length)
  })

  it('passes a local path through', async () => {
    const resolved = await resolveImageSrc('/tmp/logo.png')
    expect(resolved).toEqual({ kind: 'path', path: '/tmp/logo.png' })
  })

  it('fetches http(s) bytes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(PNG_1X1, { status: 200 })))
    const resolved = await resolveImageSrc('https://example.com/logo.png')
    expect(resolved.kind).toBe('bytes')
    if (resolved.kind === 'bytes') expect(resolved.bytes.length).toBe(PNG_1X1.length)
  })

  it('falls back when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))
    expect(await resolveImageSrc('https://example.com/missing.png')).toEqual({ kind: 'fallback' })
  })

  it('falls back when the body is over the size cap', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(PNG_1X1, {
      status: 200,
      headers: { 'content-length': String(IMAGE_FETCH_MAX_BYTES + 1) },
    })))
    expect(await resolveImageSrc('https://example.com/huge.png')).toEqual({ kind: 'fallback' })
  })

  it('falls back when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network')
    }))
    expect(await resolveImageSrc('https://example.com/down.png')).toEqual({ kind: 'fallback' })
  })
})

describe('renderPdf image embed', () => {
  it('embeds a data URI', async () => {
    const bytes = await renderPdf(`![dot](${DATA_URI})`, { visuals: { image: 'embed' } })
    expect(isPdf(bytes)).toBe(true)
  })

  it('embeds a fetched URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(PNG_1X1, { status: 200 })))
    const bytes = await renderPdf('![logo](https://example.com/logo.png)', { visuals: { image: 'embed' } })
    expect(isPdf(bytes)).toBe(true)
  })

  it('falls back to alt-text when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    const bytes = await renderPdf('![logo](https://example.com/logo.png)', { visuals: { image: 'embed' } })
    expect(isPdf(bytes)).toBe(true)
  })

  it('embeds an inline image in a paragraph', async () => {
    const bytes = await renderPdf(`Before ![dot](${DATA_URI}) after`, { visuals: { image: 'embed' } })
    expect(isPdf(bytes)).toBe(true)
  })

  it('keeps alt-text when embed is off', async () => {
    const bytes = await renderPdf('![An example image](https://example.com/image.png)')
    expect(isPdf(bytes)).toBe(true)
  })
})
