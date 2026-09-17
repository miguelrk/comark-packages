import type {
  FetchEntry,
  FetchEntryInput,
  FetchFrontmatter,
  NormalizedFetch,
} from './types.ts'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Expand a bare URL string to `{ url, method: 'GET' }`. */
export const normalizeEntry = (input: FetchEntryInput): FetchEntry => {
  if (typeof input === 'string') {
    return { url: input, method: 'GET' }
  }

  return {
    ...input,
    method: input.method ?? 'GET',
  }
}

/**
 * Read `frontmatter.fetch` and return named normalized entries.
 * Returns an empty array when the key is missing or not an object.
 */
export const normalizeFetches = (raw: unknown): NormalizedFetch[] => {
  if (!isPlainObject(raw)) return []

  const fetches = raw as FetchFrontmatter
  const out: NormalizedFetch[] = []

  for (const [name, input] of Object.entries(fetches)) {
    if (input === undefined || input === null) continue
    if (typeof input !== 'string' && !isPlainObject(input)) continue
    out.push({ name, entry: normalizeEntry(input as FetchEntryInput) })
  }

  return out
}
