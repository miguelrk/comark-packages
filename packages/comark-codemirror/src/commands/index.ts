/**
 * Commands: pure functions `(state, params) → Edit` that work in Node and in
 * the browser. The keymap and agents run the same functions.
 */
import type { EditorState, Line } from '@codemirror/state'
import type { Edit, EditError } from '../types.ts'
import { EditorSelection } from '@codemirror/state'
import { formatAttributes, parseAttributes } from '../document/attributes.ts'
import { docIndex } from '../document/index.ts'
import { formatYamlValue } from '../document/yaml.ts'

export const noop = (message: string): EditError => ({ ok: false, code: 'no_op', message })
export const badParam = (message: string): EditError => ({ ok: false, code: 'bad_param', message })

const MARKS = {
  bold: { primary: '**', alts: ['**', '__'] },
  italic: { primary: '_', alts: ['_', '*'] },
  code: { primary: '`', alts: ['`'] },
  strike: { primary: '~~', alts: ['~~'] },
} as const

export type MarkName = keyof typeof MARKS

function wordAround(state: EditorState, pos: number) {
  const line = state.doc.lineAt(pos)
  const col = pos - line.from
  const isWord = (i: number) => /[\p{L}\p{N}_]/u.test(line.text[i] ?? '')
  if (!isWord(col - 1) && !isWord(col)) return null
  let from = col
  let to = col
  while (from > 0 && isWord(from - 1)) from--
  while (to < line.text.length && isWord(to)) to++
  return { from: line.from + from, to: line.from + to }
}

export function linesInSelection(state: EditorState): Line[] {
  const seen = new Set<number>()
  const lines: Line[] = []
  for (const range of state.selection.ranges) {
    for (let n = state.doc.lineAt(range.from).number; n <= state.doc.lineAt(range.to).number; n++) {
      if (seen.has(n)) continue
      seen.add(n)
      lines.push(state.doc.line(n))
    }
  }
  return lines
}

export function toggleMark(state: EditorState, mark: MarkName): Edit {
  const spec = MARKS[mark]
  if (!spec) return badParam(`Unknown mark "${mark}".`)
  const change = state.changeByRange((range) => {
    let { from, to } = range
    if (from === to) {
      const word = wordAround(state, from)
      if (word) ({ from, to } = word)
    }
    for (const marker of spec.alts) {
      const size = marker.length
      if (marker === '*' && state.sliceDoc(Math.max(0, from - 2), from) === '**') continue
      if (from >= size && state.sliceDoc(from - size, from) === marker && state.sliceDoc(to, to + size) === marker) {
        return {
          changes: [{ from: from - size, to: from }, { from: to, to: to + size }],
          range: EditorSelection.range(from - size, Math.max(from - size, to - size)),
        }
      }
      const inner = state.sliceDoc(from, to)
      if (inner.length >= size * 2 && inner.startsWith(marker) && inner.endsWith(marker)) {
        return { changes: { from, to, insert: inner.slice(size, -size) }, range: EditorSelection.range(from, to - size * 2) }
      }
    }
    if (from === to) return { changes: { from, insert: spec.primary + spec.primary }, range: EditorSelection.cursor(from + spec.primary.length) }
    return {
      changes: [{ from, insert: spec.primary }, { from: to, insert: spec.primary }],
      range: EditorSelection.range(from + spec.primary.length, to + spec.primary.length),
    }
  })
  return { ok: true, changes: change.changes, selection: change.selection }
}

export function setHeading(state: EditorState, level: number): Edit {
  if (!Number.isInteger(level) || level < 0 || level > 6) return badParam('Heading level must be an integer from 0 to 6.')
  const changes: { from: number, to: number, insert: string }[] = []
  for (const line of linesInSelection(state)) {
    if (!line.text.trim()) continue
    const body = line.text.replace(/^(\s{0,3})#{1,6}(?:[ \t]+|(?=[ \t]*$))/, '$1')
    const indent = /^\s*/.exec(body)![0]
    const insert = level === 0 ? body : `${indent}${'#'.repeat(level)} ${body.slice(indent.length)}`
    if (insert !== line.text) changes.push({ from: line.from, to: line.to, insert })
  }
  return changes.length ? { ok: true, changes } : noop('The selected lines already have that heading level.')
}

const LIST = /^(\s*)(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/

export function toggleList(state: EditorState, kind: 'bullet' | 'ordered' | 'task'): Edit {
  const lines = linesInSelection(state).filter(l => l.text.trim())
  if (!lines.length) return noop('There is no line to change.')
  const matches = (text: string) => {
    const marker = LIST.exec(text)?.[0]
    if (!marker) return false
    if (kind === 'task') return /\[[ xX]\]/.test(marker)
    if (kind === 'ordered') return /^\s*\d/.test(marker) && !marker.includes('[')
    return /^\s*[-*+]/.test(marker) && !marker.includes('[')
  }
  const remove = lines.every(l => matches(l.text))
  let n = 0
  const changes = lines.map((line) => {
    const stripped = line.text.replace(LIST, '$1')
    if (remove) return { from: line.from, to: line.to, insert: stripped }
    const indent = /^\s*/.exec(stripped)![0]
    n++
    const marker = kind === 'ordered' ? `${n}.` : kind === 'task' ? '- [ ]' : '-'
    return { from: line.from, to: line.to, insert: `${indent}${marker} ${stripped.slice(indent.length)}` }
  })
  return { ok: true, changes }
}

export function toggleTask(state: EditorState, checked?: boolean): Edit {
  const changes: { from: number, to?: number, insert: string }[] = []
  for (const line of linesInSelection(state)) {
    const task = /^(\s*(?:[-*+]|\d{1,9}[.)])[ \t]+)\[([ xX])\]/.exec(line.text)
    if (task) {
      const next = checked ?? task[2] === ' '
      changes.push({ from: line.from + task[1]!.length + 1, to: line.from + task[1]!.length + 2, insert: next ? 'x' : ' ' })
      continue
    }
    const item = /^(\s*(?:[-*+]|\d{1,9}[.)])[ \t]+)/.exec(line.text)
    if (item) changes.push({ from: line.from + item[1]!.length, insert: `[${checked ? 'x' : ' '}] ` })
  }
  return changes.length ? { ok: true, changes } : noop('The selection has no list item.')
}

export function toggleQuote(state: EditorState): Edit {
  const lines = linesInSelection(state)
  const quoted = lines.length > 0 && lines.every(l => /^\s{0,3}>/.test(l.text) || !l.text.trim())
  const changes = lines.filter(l => l.text.trim()).map((line) => {
    if (quoted) return { from: line.from, to: line.to, insert: line.text.replace(/^(\s{0,3})>[ \t]?/, '$1') }
    const indent = /^\s{0,3}/.exec(line.text)![0]
    return { from: line.from, to: line.to, insert: `${indent}> ${line.text.slice(indent.length)}` }
  })
  return changes.length ? { ok: true, changes } : noop('There is no line to change.')
}

export function insertLink(state: EditorState, url = ''): Edit {
  const range = state.selection.main
  const text = state.sliceDoc(range.from, range.to)
  const insert = `[${text}](${url})`
  const cursor = text ? range.from + text.length + 3 + url.length : range.from + 1
  return { ok: true, changes: { from: range.from, to: range.to, insert }, selection: { anchor: cursor } }
}

const validName = (name: string) => /^[A-Za-z$][\w$.-]*$/.test(name)

/** Colons for a new block component at `pos`: one more than the innermost open component. */
export function colonsAt(state: EditorState, pos: number): number {
  const stack = docIndex(state).stackAt(state.doc.lineAt(pos).number)
  return Math.max(2, (stack.at(-1)?.colons ?? 1) + 1)
}

export function insertComponent(state: EditorState, name: string, options: { props?: Record<string, unknown>, content?: string, inline?: boolean } = {}): Edit {
  if (!validName(name)) return { ok: false, code: 'bad_name', message: `"${name}" is not a valid component name.` }
  const range = state.selection.main
  const attrs = formatAttributes(options.props ?? {})
  if (options.inline) {
    const insert = `:${name}${options.content ? `[${options.content}]` : ''}${attrs}`
    return { ok: true, changes: { from: range.from, to: range.to, insert }, selection: { anchor: range.from + insert.length } }
  }
  const colons = ':'.repeat(colonsAt(state, range.from))
  const content = options.content ?? state.sliceDoc(range.from, range.to)
  const opener = `${colons}${name}${attrs}\n`
  return {
    ok: true,
    changes: { from: range.from, to: range.to, insert: `${opener}${content}\n${colons}` },
    selection: { anchor: range.from + opener.length + content.length },
  }
}

export function wrapComponent(state: EditorState, name: string, props?: Record<string, unknown>): Edit {
  if (!validName(name)) return { ok: false, code: 'bad_name', message: `"${name}" is not a valid component name.` }
  const lines = linesInSelection(state)
  const first = lines[0]
  const last = lines.at(-1)
  if (!first || !last) return noop('There is no line to wrap.')
  const inner = state.sliceDoc(first.from, last.to)
  let depth = colonsAt(state, first.from)
  for (const m of inner.matchAll(/^\s*(:{2,})/gm)) depth = Math.max(depth, m[1]!.length + 1)
  const marker = ':'.repeat(depth)
  const opener = `${marker}${name}${formatAttributes(props ?? {})}`
  return { ok: true, changes: { from: first.from, to: last.to, insert: `${opener}\n${inner}\n${marker}` }, selection: { anchor: first.from + opener.length } }
}

/** The component at the cursor (innermost), or the one opened on the cursor line. */
function componentAt(state: EditorState, pos: number) {
  const index = docIndex(state)
  const line = state.doc.lineAt(pos).number
  return index.outline.find(n => n.kind === 'component' && n.line === line) ?? index.stackAt(line).at(-1)
}

export function unwrapComponent(state: EditorState): Edit {
  const node = componentAt(state, state.selection.main.head)
  if (!node) return noop('The cursor is not in a component.')
  const doc = state.doc
  const open = doc.line(node.line)
  const bodyLine = node.props?.closed ? node.props.endLine + 2 : node.line + 1
  if (!node.closed) return { ok: true, changes: { from: open.from, to: bodyLine <= doc.lines ? doc.line(bodyLine).from : doc.length } }
  const close = doc.line(node.endLine)
  if (bodyLine >= node.endLine) return { ok: true, changes: { from: open.from, to: close.to } }
  return { ok: true, changes: [{ from: open.from, to: doc.line(bodyLine).from }, { from: close.from - 1, to: close.to }] }
}

export function setProps(state: EditorState, props: Record<string, unknown>): Edit {
  const node = componentAt(state, state.selection.main.head)
  if (!node) return noop('The cursor is not in a component.')
  const current: Record<string, unknown> = {}
  for (const entry of node.attrs ? parseAttributes(node.attrs.text) : []) current[entry.key] = entry.value
  for (const [key, value] of Object.entries(props)) {
    if (value === null) delete current[key]
    else current[key] = value
  }
  const attrs = formatAttributes(current)
  const line = state.doc.line(node.line)
  const nameEnd = node.from + node.colons! + node.name.length
  if (node.attrs) return { ok: true, changes: { from: node.attrs.from, to: node.attrs.to, insert: attrs } }
  const label = /^\[[^\]]*\]/.exec(state.sliceDoc(nameEnd, line.to))?.[0] ?? ''
  return { ok: true, changes: { from: nameEnd + label.length, insert: attrs } }
}

/** Move a component's inline attribute block into a YAML props block. */
export function propsToYaml(state: EditorState): Edit {
  const node = componentAt(state, state.selection.main.head)
  if (!node?.attrs) return noop('The component has no attribute block.')
  const entries = parseAttributes(node.attrs.text)
  const indent = /^\s*/.exec(state.doc.line(node.line).text)![0]
  const yaml = entries.map(e => `${indent}${e.key}: ${e.value === true ? 'true' : e.prefix ? JSON.stringify(e.value) : formatYamlValue(e.value)}`)
  const line = state.doc.line(node.line)
  const changes = [{ from: node.attrs.from, to: node.attrs.to, insert: '' }]
  if (node.props) {
    const at = state.doc.line(node.props.line).from
    changes.push({ from: at, to: at, insert: `${yaml.join('\n')}\n` })
  }
  else changes.push({ from: line.to, to: line.to, insert: `\n${indent}---\n${yaml.join('\n')}\n${indent}---` })
  return { ok: true, changes }
}

export function insertComponentCloser(state: EditorState): Edit {
  const range = state.selection.main
  const line = state.doc.lineAt(range.head)
  if (!range.empty || range.head !== line.to) return noop('The cursor is not at the end of the line.')
  const match = /^(\s*(?:(?:[-*+]|\d{1,9}[.)])\s+)?)(:{2,})([A-Za-z$][\w$.-]*)[^\n]*$/.exec(line.text)
  if (!match) return noop('This line does not open a component.')
  const node = docIndex(state).outline.find(n => n.kind === 'component' && n.line === line.number)
  if (node?.closed) return noop('The component is already closed.')
  const indent = match[1]!.replace(/[^\s]/g, ' ')
  return { ok: true, changes: { from: line.to, insert: `\n${indent}\n${indent}${match[2]}` }, selection: { anchor: line.to + 1 + indent.length } }
}

export function setFrontmatter(state: EditorState, key: string, value: unknown): Edit {
  if (!/^[\w$.-]+$/.test(key)) return badParam(`"${key}" is not a valid key.`)
  const index = docIndex(state)
  const fm = index.frontmatter.node
  const entry = `${key}: ${formatYamlValue(value)}`
  if (!fm) return { ok: true, changes: { from: 0, insert: `---\n${entry}\n---\n\n` } }
  for (let l = fm.line + 1; l < fm.endLine; l++) {
    const line = state.doc.line(l)
    if (new RegExp(`^${key.replace(/[.$]/g, '\\$&')}:`).test(line.text)) {
      // replace the key and its indented block
      let end = line
      while (end.number + 1 < fm.endLine && /^\s+\S/.test(state.doc.line(end.number + 1).text)) end = state.doc.line(end.number + 1)
      return value === null ? { ok: true, changes: { from: line.from, to: Math.min(state.doc.length, end.to + 1) } } : { ok: true, changes: { from: line.from, to: end.to, insert: entry } }
    }
  }
  if (value === null) return noop(`There is no "${key}" key.`)
  const closer = state.doc.line(fm.endLine)
  return { ok: true, changes: { from: closer.from, insert: `${entry}\n` } }
}

/** Align the columns of the GFM table at the cursor. */
export function formatTable(state: EditorState): Edit {
  const pos = state.selection.main.head
  const at = state.doc.lineAt(pos).number
  const isRow = (n: number) => n >= 1 && n <= state.doc.lines && /^\s*\|.*\|\s*$/.test(state.doc.line(n).text)
  if (!isRow(at)) return noop('The cursor is not in a table.')
  let first = at
  let last = at
  while (isRow(first - 1)) first--
  while (isRow(last + 1)) last++
  const rows: string[][] = []
  for (let n = first; n <= last; n++) rows.push(state.doc.line(n).text.trim().slice(1, -1).split(/(?<!\\)\|/).map(c => c.trim()))
  const cols = Math.max(...rows.map(r => r.length))
  const sep = (c: string) => /^:?-+:?$/.test(c)
  const width = Array.from({ length: cols }, (_, i) => Math.max(3, ...rows.filter(r => !r.every(sep)).map(r => (r[i] ?? '').length)))
  const text = rows.map((r) => {
    if (r.every(sep)) return `| ${width.map((w, i) => { const c = r[i] ?? '---'; return `${c.startsWith(':') ? ':' : '-'}${'-'.repeat(w - 2)}${c.endsWith(':') ? ':' : '-'}` }).join(' | ')} |`
    return `| ${width.map((w, i) => (r[i] ?? '').padEnd(w)).join(' | ')} |`
  }).join('\n')
  return { ok: true, changes: { from: state.doc.line(first).from, to: state.doc.line(last).to, insert: text } }
}
