/**
 * Scan raw markdown for duplicate keys under any `default:` section inside
 * `kv:` frontmatter — for both single-driver and multi-driver (namespaced) forms.
 *
 * The YAML parser throws on exact duplicates; this guard runs in `pre()` as an
 * additional safeguard for parsers that silently keep the last value.
 */
export const findDuplicateKvDefaultKeys = (markdown: string): string[] => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match?.[1]) return []

  const lines = match[1].split(/\r?\n/)
  let inKv = false
  let kvIndent = -1
  let inDefault = false
  let defaultIndent = -1
  let childIndent: number | null = null
  let seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const line of lines) {
    if (/^\s*#/.test(line) || line.trim() === '') continue

    const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0
    const content = line.trim()

    if (!inKv) {
      if (/^kv\s*:/.test(content)) {
        inKv = true
        kvIndent = indent
      }
      continue
    }

    if (indent <= kvIndent && content.length > 0) break

    if (!inDefault) {
      if (/^default\s*:/.test(content) && indent > kvIndent) {
        inDefault = true
        defaultIndent = indent
        seen = new Set()
        childIndent = null
      }
      continue
    }

    if (indent <= defaultIndent && content.length > 0) {
      inDefault = false
      childIndent = null
      seen = new Set()
      if (indent <= kvIndent) break
      if (/^default\s*:/.test(content)) {
        inDefault = true
        defaultIndent = indent
      }
      continue
    }

    const keyMatch = content.match(/^([A-Za-z0-9_.-]+)\s*:/)
    if (!keyMatch?.[1] || indent <= defaultIndent) continue

    if (childIndent === null) childIndent = indent
    if (indent !== childIndent) continue

    const key = keyMatch[1]
    if (seen.has(key)) duplicates.add(key)
    else seen.add(key)
  }

  return [...duplicates]
}

export const assertNoDuplicateKvDefaultKeys = (markdown: string): void => {
  const dupes = findDuplicateKvDefaultKeys(markdown)
  if (dupes.length > 0) {
    throw new Error(
      `[comark-kv] Duplicate key(s) under kv.default: ${dupes.map((k) => `"${k}"`).join(', ')}`,
    )
  }
}
