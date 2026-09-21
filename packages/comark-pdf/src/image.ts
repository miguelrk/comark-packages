export const IMAGE_FETCH_TIMEOUT_MS = 15_000
export const IMAGE_FETCH_MAX_BYTES = 8 * 1024 * 1024

export type ResolvedImage =
  | { kind: 'bytes', bytes: Uint8Array }
  | { kind: 'path', path: string }
  | { kind: 'fallback' }

const decodeDataUri = (src: string): Uint8Array | null => {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,([\s\S]+)$/.exec(src)
  if (!match?.[1]) return null
  try {
    const binary = atob(match[1])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.length > 0 ? bytes : null
  }
  catch {
    return null
  }
}

const readBounded = async (response: Response): Promise<Uint8Array | null> => {
  const declared = Number(response.headers?.get?.('content-length') ?? NaN)
  if (Number.isFinite(declared) && declared > IMAGE_FETCH_MAX_BYTES) return null

  const body = response.body
  if (!body?.getReader) {
    const whole = new Uint8Array(await response.arrayBuffer())
    return whole.length > IMAGE_FETCH_MAX_BYTES ? null : whole
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > IMAGE_FETCH_MAX_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  if (chunks.length === 1) return chunks[0]!
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

const fetchImage = async (url: string): Promise<ResolvedImage> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) })
    if (!response.ok) return { kind: 'fallback' }
    const bytes = await readBounded(response)
    if (!bytes || bytes.length === 0) return { kind: 'fallback' }
    return { kind: 'bytes', bytes }
  }
  catch {
    return { kind: 'fallback' }
  }
}

export const resolveImageSrc = async (src: string): Promise<ResolvedImage> => {
  const value = src.trim()
  if (!value) return { kind: 'fallback' }
  if (value.startsWith('data:image/')) {
    const bytes = decodeDataUri(value)
    return bytes ? { kind: 'bytes', bytes } : { kind: 'fallback' }
  }
  if (/^https?:\/\//i.test(value)) return fetchImage(value)
  return { kind: 'path', path: value }
}
