import type { FetchEntry, NormalizedFetch } from './types.ts'

export interface ValidateResult {
  ok: boolean
  entry?: FetchEntry
  error?: string
  warnings?: string[]
}

/**
 * Validate a normalized fetch entry.
 * Relative URLs and non-http(s) schemes are rejected.
 */
export const validateEntry = (name: string, entry: FetchEntry): ValidateResult => {
  if (typeof entry.url !== 'string' || entry.url.length === 0) {
    return { ok: false, error: `Fetch "${name}": url is required` }
  }

  let parsed: URL
  try {
    parsed = new URL(entry.url)
  } catch {
    return {
      ok: false,
      error: `Fetch "${name}": url must be an absolute http(s) URL (got "${entry.url}")`,
    }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      error: `Fetch "${name}": only http: and https: schemes are allowed (got "${parsed.protocol}")`,
    }
  }

  return { ok: true, entry }
}

export const validateFetches = (
  fetches: NormalizedFetch[],
): {
  valid: NormalizedFetch[]
  errors: Record<string, { message: string; url?: string }>
  warnings: string[]
} => {
  const valid: NormalizedFetch[] = []
  const errors: Record<string, { message: string; url?: string }> = {}
  const warnings: string[] = []

  for (const item of fetches) {
    const result = validateEntry(item.name, item.entry)
    if (result.warnings) warnings.push(...result.warnings)
    if (!result.ok || !result.entry) {
      errors[item.name] = {
        message: result.error ?? 'invalid fetch',
        url: item.entry.url,
      }
      continue
    }
    valid.push({ name: item.name, entry: result.entry })
  }

  return { valid, errors, warnings }
}
