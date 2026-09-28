/**
 * A small YAML reader for frontmatter and component props blocks: nested
 * maps, lists, flow collections, block scalars and plain scalars. It never
 * throws; malformed lines are skipped. Highlighting uses `@codemirror/lang-yaml`.
 */

export function parseScalar(raw: string): unknown {
  const s = raw.trim()
  if (s === '' || s === '~' || s === 'null') return null
  if (s === 'true') return true
  if (s === 'false') return false
  if (/^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(s)) return Number(s)
  if ((s.startsWith('"') && s.endsWith('"') && s.length > 1) || (s.startsWith('\'') && s.endsWith('\'') && s.length > 1)) {
    const inner = s.slice(1, -1)
    return s[0] === '"' ? inner.replace(/\\"/g, '"').replace(/\\n/g, '\n') : inner.replace(/''/g, '\'')
  }
  if (s.startsWith('[') && s.endsWith(']')) return splitFlow(s.slice(1, -1)).map(parseScalar)
  if (s.startsWith('{') && s.endsWith('}')) {
    const out: Record<string, unknown> = {}
    for (const part of splitFlow(s.slice(1, -1))) {
      const at = part.indexOf(':')
      if (at > 0) out[part.slice(0, at).trim()] = parseScalar(part.slice(at + 1))
    }
    return out
  }
  return s.replace(/\s+#.*$/, '')
}

function splitFlow(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote = ''
  let cur = ''
  for (const c of s) {
    if (quote) {
      if (c === quote) quote = ''
    }
    else if (c === '"' || c === '\'') quote = c
    else if (c === '[' || c === '{') depth++
    else if (c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

interface Row { indent: number, text: string }

const indentOf = (line: string) => line.length - line.trimStart().length

/** Parse YAML lines (without the `---` fences) into a value. */
export function parseYaml(source: string | readonly string[]): unknown {
  const lines = typeof source === 'string' ? source.split('\n') : source
  const rows: Row[] = []
  for (const line of lines) {
    if (!line.trim() || /^\s*#/.test(line)) {
      rows.push({ indent: -1, text: '' })
      continue
    }
    rows.push({ indent: indentOf(line), text: line.trim() })
  }
  let i = 0
  const skipBlank = () => {
    while (i < rows.length && rows[i]!.indent < 0) i++
  }

  const blockScalar = (parent: number, fold: boolean): string => {
    const parts: string[] = []
    while (i < rows.length && (rows[i]!.indent < 0 || rows[i]!.indent > parent)) {
      parts.push(lines[i]!.trim())
      i++
    }
    while (parts.length && !parts.at(-1)) parts.pop()
    return fold ? parts.join(' ') : parts.join('\n')
  }

  const value = (rest: string, parent: number): unknown => {
    if (rest === '|' || rest === '|-' || rest === '>' || rest === '>-') return blockScalar(parent, rest[0] === '>')
    if (rest !== '') return parseScalar(rest)
    skipBlank()
    const next = rows[i]
    if (!next || next.indent <= parent) {
      // `key:` followed by a list at the same indent is still that key's list
      if (next && next.indent === parent && next.text.startsWith('- ')) return node(parent)
      return null
    }
    return node(next.indent)
  }

  const node = (indent: number): unknown => {
    skipBlank()
    const first = rows[i]
    if (!first) return null
    if (first.text === '-' || first.text.startsWith('- ')) {
      const list: unknown[] = []
      while (i < rows.length) {
        skipBlank()
        const row = rows[i]
        if (!row || row.indent !== indent || !(row.text === '-' || row.text.startsWith('- '))) break
        const rest = row.text.slice(1).trim()
        i++
        const kv = /^([\w$.-]+|"[^"]*"|'[^']*'):(?:\s+(.*)|$)/.exec(rest)
        if (kv) {
          // `- key: value` starts a map whose keys sit at indent + 2
          const inner = indent + 2
          const obj: Record<string, unknown> = { [unquote(kv[1]!)]: value(kv[2]?.trim() ?? '', inner) }
          Object.assign(obj, map(inner, true) as Record<string, unknown>)
          list.push(obj)
        }
        else list.push(rest ? parseScalar(rest) : value('', indent))
      }
      return list
    }
    return map(indent, false)
  }

  const map = (indent: number, continuation: boolean): unknown => {
    const obj: Record<string, unknown> = {}
    while (i < rows.length) {
      skipBlank()
      const row = rows[i]
      if (!row || row.indent !== indent || (!continuation && row.text.startsWith('- '))) break
      if (continuation && row.text.startsWith('- ')) break
      const kv = /^([\w$.-]+|"[^"]*"|'[^']*'):(?:\s+(.*)|$)/.exec(row.text)
      i++
      if (!kv) continue
      obj[unquote(kv[1]!)] = value(kv[2]?.trim() ?? '', indent)
    }
    return obj
  }

  skipBlank()
  if (i >= rows.length) return {}
  return node(rows[i]!.indent)
}

const unquote = (k: string) => (k[0] === '"' || k[0] === '\'') ? k.slice(1, -1) : k

/**
 * Where the cursor is in a YAML block: the key path of the parents and
 * whether it is typing a key or a value.
 */
export type YamlCursor =
  | { at: 'key', path: string[], typed: string, present: string[] }
  | { at: 'value', path: string[], key: string, typed: string }
  | { at: 'item', path: string[], typed: string }

/** `lines` are the block lines before the cursor line; `before` is the cursor line up to the cursor. */
export function yamlCursor(lines: readonly string[], before: string): YamlCursor | null {
  const indent = indentOf(before)
  const path: string[] = []
  let limit = indent
  // parent keys: the closest lines above with a smaller indent that end with `key:`
  for (let l = lines.length - 1; l >= 0 && limit > 0; l--) {
    const line = lines[l]!
    if (!line.trim()) continue
    const ind = indentOf(line)
    if (ind >= limit) continue
    const m = /^\s*(?:-\s+)?([\w$.-]+):\s*$/.exec(line)
    if (m) path.unshift(m[1]!)
    else if (!/^\s*-\s/.test(line)) break
    limit = ind
  }
  const siblings = (): string[] => {
    const out: string[] = []
    for (let l = lines.length - 1; l >= 0; l--) {
      const line = lines[l]!
      if (!line.trim()) continue
      const ind = indentOf(line)
      if (ind < indent) break
      const m = ind === indent ? /^\s*([\w$.-]+):/.exec(line) : null
      if (m) out.push(m[1]!)
    }
    return out
  }
  const text = before.trimStart()
  const item = /^-\s+(\S*)$/.exec(text)
  if (item) return { at: 'item', path, typed: item[1]! }
  const val = /^(?:-\s+)?([\w$.-]+):\s+(.*)$/.exec(text)
  if (val) return { at: 'value', path, key: val[1]!, typed: val[2]!.replace(/^["']/, '') }
  const key = /^([\w$-]*)$/.exec(text)
  if (key) return { at: 'key', path, typed: key[1]!, present: siblings() }
  return null
}

/** Format a value as a YAML scalar (quotes only when needed). */
export function formatYamlValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') {
    return /^[\w./@-][\w ./@-]*$/.test(value) && !/^(?:true|false|null|~|[-+]?\d)/.test(value) ? value : JSON.stringify(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}
