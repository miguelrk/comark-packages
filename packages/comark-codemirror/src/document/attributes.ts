/**
 * Attribute blocks: `{#id .class key="value" :bound="path" ::model="data.x" @event bool}`.
 * One tokenizer serves highlighting, cursor contexts, the document index and lint.
 * It accepts unterminated input (`{title="x`), which is the normal case while typing.
 */

export type AttrTokenType = 'open' | 'close' | 'class' | 'id' | 'key' | 'equals' | 'value'

export interface AttrToken {
  type: AttrTokenType
  from: number
  to: number
}

export type AttrPrefix = '' | ':' | '::' | '@'

export interface AttrEntry {
  /** Key as written, with its prefix (`:title`). `class` and `id` for `.x` / `#x`. */
  key: string
  /** Key without the prefix. */
  name: string
  prefix: AttrPrefix
  /** Unquoted value, or `true` for a bare key. */
  value: string | true
  from: number
  to: number
  /** The value's quote was never closed. */
  open?: boolean
}

const isSpace = (c: string | undefined) => c === ' ' || c === '\t'

/**
 * Tokenize the attribute block starting at `text[start] === '{'`.
 * Stops at the matching `}` or the end of `text`. Offsets are shifted by `offset`.
 */
export function scanAttributes(text: string, start = 0, offset = 0): { tokens: AttrToken[], end: number, closed: boolean } {
  const tokens: AttrToken[] = [{ type: 'open', from: offset + start, to: offset + start + 1 }]
  let i = start + 1
  while (i < text.length) {
    const c = text[i]!
    if (isSpace(c)) {
      i++
      continue
    }
    if (c === '}') {
      tokens.push({ type: 'close', from: offset + i, to: offset + i + 1 })
      return { tokens, end: i + 1, closed: true }
    }
    if (c === '.' || c === '#') {
      let j = i + 1
      while (j < text.length && /[\w-]/.test(text[j]!)) j++
      tokens.push({ type: c === '.' ? 'class' : 'id', from: offset + i, to: offset + j })
      i = j
      continue
    }
    let j = i
    while (j < text.length && !isSpace(text[j]) && text[j] !== '=' && text[j] !== '}') j++
    if (j === i) {
      // a stray `=`
      i++
      continue
    }
    tokens.push({ type: 'key', from: offset + i, to: offset + j })
    i = j
    if (text[i] !== '=') continue
    tokens.push({ type: 'equals', from: offset + i, to: offset + i + 1 })
    i++
    const q = text[i]
    if (q === '"' || q === '\'') {
      const close = text.indexOf(q, i + 1)
      const to = close < 0 ? text.length : close + 1
      tokens.push({ type: 'value', from: offset + i, to: offset + to })
      i = to
    }
    else {
      let k = i
      while (k < text.length && !isSpace(text[k]) && text[k] !== '}') k++
      if (k > i) tokens.push({ type: 'value', from: offset + i, to: offset + k })
      i = k
    }
  }
  return { tokens, end: text.length, closed: false }
}

export function splitPrefix(key: string): { prefix: AttrPrefix, name: string } {
  if (key.startsWith('::')) return { prefix: '::', name: key.slice(2) }
  if (key.startsWith(':')) return { prefix: ':', name: key.slice(1) }
  if (key.startsWith('@')) return { prefix: '@', name: key.slice(1) }
  return { prefix: '', name: key }
}

/** Parse the attribute block at `text[start]` into entries (offsets shifted by `offset`). */
export function parseAttributes(text: string, start = 0, offset = 0): AttrEntry[] {
  const { tokens } = scanAttributes(text, start, offset)
  const slice = (t: AttrToken) => text.slice(t.from - offset, t.to - offset)
  const out: AttrEntry[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.type === 'class' || t.type === 'id') {
      const name = t.type === 'class' ? 'class' : 'id'
      const value = slice(t).slice(1)
      const existing = name === 'class' ? out.find(e => e.key === 'class') : undefined
      if (existing && typeof existing.value === 'string') {
        existing.value = `${existing.value} ${value}`
        existing.to = t.to
      }
      else out.push({ key: name, name, prefix: '', value, from: t.from, to: t.to })
      continue
    }
    if (t.type !== 'key') continue
    const key = slice(t)
    const { prefix, name } = splitPrefix(key)
    const eq = tokens[i + 1]
    const val = tokens[i + 2]
    if (eq?.type === 'equals' && val?.type === 'value') {
      const raw = slice(val)
      const q = raw[0]
      const quoted = q === '"' || q === '\''
      const open = quoted && (raw.length < 2 || raw[raw.length - 1] !== q)
      out.push({ key, name, prefix, value: quoted ? raw.slice(1, open ? undefined : -1) : raw, from: t.from, to: val.to, open })
      i += 2
    }
    else if (eq?.type === 'equals') {
      out.push({ key, name, prefix, value: '', from: t.from, to: eq.to, open: true })
      i += 1
    }
    else {
      out.push({ key, name, prefix, value: true, from: t.from, to: t.to })
    }
  }
  return out
}

/** Where the cursor is inside an attribute block (`body` is the text after `{` up to the cursor). */
export type AttrCursor =
  | { at: 'key', typed: string, prefix: AttrPrefix, present: string[], separated: boolean }
  | { at: 'value', typed: string, key: string, name: string, prefix: AttrPrefix, quote: string, present: string[] }
  | { at: 'class', typed: string, present: string[] }
  | { at: 'id', typed: string, present: string[] }

export function attrCursor(body: string): AttrCursor | null {
  const entries = parseAttributes(`{${body}`)
  const last = entries.at(-1)
  const present = entries.filter(e => e !== last || !e.open).map(e => e.name)
  // inside a value: `key="typ` or `key=typ`
  if (last?.open) {
    const raw = body.slice(body.indexOf('=', last.from - 1 + last.key.length) + 1)
    const quote = raw[0] === '"' || raw[0] === '\'' ? raw[0] : ''
    return { at: 'value', typed: String(last.value), key: last.key, name: last.name, prefix: last.prefix, quote, present: present.filter(p => p !== last.name) }
  }
  const unquoted = /(?:^|[ \t])([^\s=}"']+)=([^\s"'}]*)$/.exec(body)
  if (unquoted) {
    const { prefix, name } = splitPrefix(unquoted[1]!)
    return { at: 'value', typed: unquoted[2]!, key: unquoted[1]!, name, prefix, quote: '', present: present.filter(p => p !== name) }
  }
  const cls = /(?:^|[ \t])([.#])([\w-]*)$/.exec(body)
  if (cls) return cls[1] === '.' ? { at: 'class', typed: cls[2]!, present } : { at: 'id', typed: cls[2]!, present }
  const key = /(?:^|[ \t])(::|:|@)?([\w-]*)$/.exec(body)
  if (key) {
    const typedFull = (key[1] ?? '') + key[2]!
    const separated = body.length === typedFull.length || /[ \t]$/.test(body.slice(0, body.length - typedFull.length))
    return { at: 'key', typed: typedFull, prefix: (key[1] ?? '') as AttrPrefix, present: present.filter(p => p !== key[2]), separated }
  }
  if (/["']$/.test(body)) return { at: 'key', typed: '', prefix: '', present, separated: false }
  return null
}

/** Serialize props as an attribute block: `{title="A" .x #y :bound="p" bool}`. */
export function formatAttributes(props: Readonly<Record<string, unknown>>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false || value === null) continue
    if (key === 'id' && typeof value === 'string' && /^[\w-]+$/.test(value)) parts.push(`#${value}`)
    else if (key === 'class' && typeof value === 'string' && value.split(/\s+/).every(c => /^[\w-]*$/.test(c))) parts.push(...value.split(/\s+/).filter(Boolean).map(c => `.${c}`))
    else if (value === true) parts.push(key)
    else if (typeof value === 'string') parts.push(`${key}="${value.replace(/"/g, '&quot;')}"`)
    else parts.push(`${key.startsWith(':') ? key : `:${key}`}='${JSON.stringify(value).replace(/'/g, '&#39;')}'`)
  }
  return parts.length ? `{${parts.join(' ')}}` : ''
}
