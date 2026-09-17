import type { FetchEntry } from './types.ts'

export interface FetchJsonOptions {
  entry: FetchEntry
  fetchImpl: typeof globalThis.fetch
  signal?: AbortSignal
}

const retryAttempts = (retry: number | boolean | undefined): number => {
  if (retry === false) return 1
  if (retry === true) return 4
  if (typeof retry === 'number') return retry + 1
  return 1
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** One-shot JSON fetch for a frontmatter entry. */
export const fetchJson = async ({
  entry,
  fetchImpl,
  signal,
}: FetchJsonOptions): Promise<unknown> => {
  const method = (entry.method ?? 'GET').toUpperCase()
  const init: RequestInit = {
    method,
    headers: entry.headers,
    credentials: entry.credentials ?? 'omit',
    signal,
  }

  if (entry.body !== undefined && method !== 'GET' && method !== 'HEAD') {
    init.body = entry.body
  }

  const response = await fetchImpl(entry.url, init)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${entry.url}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return await response.json()
  }

  const text = await response.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/** Fetch with entry-level retry semantics. */
export const fetchJsonWithRetry = async (
  options: FetchJsonOptions,
): Promise<unknown> => {
  const attempts = retryAttempts(options.entry.retry)
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetchJson(options)
    } catch (error) {
      lastError = error
      if (attempt < attempts - 1) {
        await sleep(Math.min(1000 * 2 ** attempt, 30_000))
      }
    }
  }

  throw lastError
}
