/**
 * Check whether a URL's origin is allowed.
 * - `allowOrigins` containing `'*'` allows any http(s) origin.
 * - Empty allowlist denies unless `hasCustomFetch` is true (host owns the network).
 */
export const isOriginAllowed = (
  url: string,
  allowOrigins: string[] | undefined,
  hasCustomFetch: boolean,
): boolean => {
  if (hasCustomFetch) return true

  const list = allowOrigins ?? []
  if (list.includes('*')) return true
  if (list.length === 0) return false

  let origin: string
  try {
    origin = new URL(url).origin
  } catch {
    return false
  }

  return list.some((allowed) => {
    if (allowed === '*') return true
    try {
      return new URL(allowed).origin === origin || allowed === origin
    } catch {
      return allowed === origin
    }
  })
}

export const originDeniedMessage = (url: string): string =>
  `Origin not allowed for "${url}". Pass allowOrigins (or allowOrigins: ['*']) or a custom fetch.`
