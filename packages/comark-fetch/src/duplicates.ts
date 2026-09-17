/**
 * Scan raw markdown for duplicate keys under a `fetch:` YAML map.
 * Parsed YAML silently keeps the last duplicate; this catch happens in `pre()`.
 */
export const findDuplicateFetchKeys = (markdown: string): string[] => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match?.[1]) return []

  const lines = match[1].split(/\r?\n/)
  let inFetch = false
  let fetchIndent = -1
  let childIndent: number | null = null
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const line of lines) {
    if (/^\s*#/.test(line) || line.trim() === '') continue

    const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0
    const content = line.trim()

    if (!inFetch) {
      if (/^fetch\s*:/.test(content)) {
        inFetch = true
        fetchIndent = indent
      }
      continue
    }

    if (indent <= fetchIndent && content.length > 0) break

    const keyMatch = content.match(/^([A-Za-z0-9_.-]+)\s*:/)
    if (!keyMatch?.[1] || indent <= fetchIndent) continue

    if (childIndent === null) childIndent = indent
    if (indent !== childIndent) continue

    const key = keyMatch[1]
    if (seen.has(key)) duplicates.add(key)
    else seen.add(key)
  }

  return [...duplicates]
}

export const assertNoDuplicateFetchKeys = (markdown: string): void => {
  const dupes = findDuplicateFetchKeys(markdown)
  if (dupes.length > 0) {
    throw new Error(
      `[comark-fetch] Duplicate key(s) under fetch: ${dupes.map((k) => `"${k}"`).join(', ')}`,
    )
  }
}
