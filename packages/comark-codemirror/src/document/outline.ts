/**
 * The structure index: one pass over the lines finds frontmatter, fences,
 * math blocks, components (with their attribute block and YAML props block),
 * slots and headings. It works on incomplete input and does not need a DOM.
 */
import type { Text } from '@codemirror/state'
import { scanAttributes } from './attributes.ts'

export type OutlineKind = 'heading' | 'component' | 'fence' | 'frontmatter' | 'math' | 'slot'

export interface OutlineNode {
  kind: OutlineKind
  /** Component or slot name, heading text, fence language. */
  name: string
  from: number
  to: number
  contentFrom: number
  contentTo: number
  /** 1-based first line. */
  line: number
  endLine: number
  closed: boolean
  /** Heading level. */
  level?: number
  /** Heading id (comark rules: hierarchical under h2+, `-n` on duplicates, `{#id}` wins). */
  id?: string
  /** Component colon count. */
  colons?: number
  /** The `{…}` attribute block on a component opener or slot line. */
  attrs?: { from: number, to: number, text: string }
  /** The YAML props block (`---` right under a component opener): content lines, fences excluded. */
  props?: { line: number, endLine: number, closed: boolean }
  /** Fence info string after the language. */
  info?: string
  /** Index of the enclosing component in the outline. */
  parent?: number
  /** Component nesting depth (0 at the top). */
  depth: number
}

interface DocLine { from: number, to: number, text: string, number: number }

interface Frame {
  kind: 'component' | 'fence' | 'math' | 'frontmatter' | 'props'
  index: number
  colons?: number
  marker?: string
}

export function linesOf(doc: Text | string): { lines: DocLine[], length: number } {
  if (typeof doc === 'string') {
    let from = 0
    const lines = doc.split('\n').map((text, index) => {
      const line = { from, to: from + text.length, text, number: index + 1 }
      from += text.length + 1
      return line
    })
    return { lines, length: doc.length }
  }
  const lines: DocLine[] = []
  let from = 0
  let number = 1
  for (const text of doc.iterLines()) {
    lines.push({ from, to: from + text.length, text, number: number++ })
    from += text.length + 1
  }
  return { lines, length: doc.length }
}

/** Container prefix of a line: indentation, list markers (with a task box) and `>`. */
export const LEAD = /^(?:[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?|>[ \t]?))*[ \t]*/

const FM_CLOSE = /^(?:---|\.\.\.)[ \t]*$/

/** First characters that can start something the outline tracks (after container markers). */
const STARTS = new Set([...':#`~$-*+>0123456789'].map(c => c.charCodeAt(0)))

/** comark's heading slug. */
export function slugify(text: string): string {
  let slug = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  if (/^\d/.test(slug)) slug = `_${slug}`
  return slug
}

/** Plain text of a heading: markup, links and a trailing attribute block removed. */
export function headingText(raw: string): { text: string, explicitId?: string } {
  let text = raw.replace(/\s+#+\s*$/, '')
  let explicitId: string | undefined
  const attrs = /\s*\{([^{}]*)\}\s*$/.exec(text)
  if (attrs) {
    explicitId = /(?:^|\s)#([\w-]+)/.exec(attrs[1]!)?.[1]
    text = text.slice(0, attrs.index)
  }
  text = text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2')
    .replace(/\{\{\s*([^}]*?)\s*\}\}/g, '$1')
  return { text: text.trim(), explicitId }
}

export function outline(doc: Text | string): OutlineNode[] {
  const { lines, length } = linesOf(doc)
  const nodes: OutlineNode[] = []
  const stack: Frame[] = []
  const top = () => stack.at(-1)
  const componentParent = () => {
    for (let s = stack.length - 1; s >= 0; s--) if (stack[s]!.kind === 'component') return stack[s]!.index
    return undefined
  }
  const depth = () => stack.filter(f => f.kind === 'component').length

  const close = (frame: Frame, line: DocLine, closed: boolean) => {
    const node = nodes[frame.index]
    if (!node) return
    node.to = line.to
    node.endLine = line.number
    node.closed = closed
    node.contentTo = closed ? line.from : line.to
  }

  const push = (node: Omit<OutlineNode, 'parent' | 'depth'>, frame?: Omit<Frame, 'index'>) => {
    const full: OutlineNode = { ...node, parent: componentParent(), depth: depth() }
    if (frame) stack.push({ ...frame, index: nodes.length })
    nodes.push(full)
    return full
  }

  for (const line of lines) {
    // fast path: outside special blocks, a line whose first character cannot start a construct is prose
    if (!stack.length || stack.at(-1)!.kind === 'component') {
      const first = line.text.charCodeAt(line.text.length - line.text.trimStart().length)
      if (Number.isNaN(first) || !STARTS.has(first)) continue
    }
    const lead = LEAD.exec(line.text)?.[0] ?? ''
    const body = line.text.slice(lead.length).trimEnd()
    const bodyFrom = line.from + lead.length
    const frame = top()

    if (frame?.kind === 'frontmatter') {
      if (FM_CLOSE.test(line.text)) {
        close(frame, line, true)
        stack.pop()
      }
      continue
    }
    if (frame?.kind === 'props') {
      const owner = nodes[frame.index]!
      if (/^---[ \t]*$/.test(body)) {
        owner.props!.endLine = line.number - 1
        owner.props!.closed = true
        stack.pop()
      }
      continue
    }
    if (frame?.kind === 'fence') {
      if (body.startsWith(frame.marker!) && /^(`+|~+)$/.test(body) && body.length >= frame.marker!.length) {
        close(frame, line, true)
        stack.pop()
      }
      continue
    }
    if (frame?.kind === 'math') {
      if (/\$\$$/.test(body)) {
        close(frame, line, true)
        stack.pop()
      }
      continue
    }

    if (line.number === 1 && /^---[ \t]*$/.test(line.text)) {
      const closer = lines.findIndex((l, i) => i > 0 && FM_CLOSE.test(l.text))
      // an empty `---\n---` is two thematic breaks (comark)
      if (closer > 1) {
        push({ kind: 'frontmatter', name: 'frontmatter', from: line.from, to: length, contentFrom: line.to + 1, contentTo: length, line: 1, endLine: 1, closed: false }, { kind: 'frontmatter' })
        continue
      }
    }

    // component props block: `---` right under the opener
    const prev = nodes.at(-1)
    if (frame?.kind === 'component' && prev && prev === nodes[frame.index] && prev.line === line.number - 1 && /^---[ \t]*$/.test(body)) {
      prev.props = { line: line.number + 1, endLine: lines.length, closed: false }
      stack.push({ kind: 'props', index: frame.index })
      continue
    }

    const fence = /^(`{3,}|~{3,})(.*)$/.exec(body)
    if (fence && !(fence[1]![0] === '`' && fence[2]!.includes('`'))) {
      const info = fence[2]!.trim()
      const lang = /^[^\s{[]*/.exec(info)?.[0] ?? ''
      push({ kind: 'fence', name: lang, info: info.slice(lang.length).trim(), from: bodyFrom, to: length, contentFrom: Math.min(length, line.to + 1), contentTo: length, line: line.number, endLine: lines.length, closed: false }, { kind: 'fence', marker: fence[1]! })
      continue
    }

    if (/^\$\$/.test(body) && !(body.length > 2 && /\$\$$/.test(body.slice(2)))) {
      push({ kind: 'math', name: 'math', from: bodyFrom, to: length, contentFrom: Math.min(length, line.to + 1), contentTo: length, line: line.number, endLine: lines.length, closed: false }, { kind: 'math' })
      continue
    }

    const opener = /^(:{2,})([A-Za-z$][\w$.-]*)/.exec(body)
    if (opener) {
      const brace = body.indexOf('{', opener[0].length)
      let attrs: OutlineNode['attrs']
      if (brace === opener[0].length || (brace > 0 && /^\[[^\]]*\]$/.test(body.slice(opener[0].length, brace)))) {
        const scan = scanAttributes(body, brace)
        attrs = { from: bodyFrom + brace, to: bodyFrom + scan.end, text: body.slice(brace, scan.end) }
      }
      push({ kind: 'component', name: opener[2]!, colons: opener[1]!.length, attrs, from: bodyFrom, to: length, contentFrom: Math.min(length, line.to + 1), contentTo: length, line: line.number, endLine: lines.length, closed: false }, { kind: 'component', colons: opener[1]!.length })
      continue
    }

    const closer = /^(:{2,})$/.exec(body)
    if (closer) {
      const colons = closer[1]!.length
      let found = -1
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s]!.kind === 'component' && stack[s]!.colons === colons) {
          found = s
          break
        }
      }
      if (found >= 0) {
        while (stack.length > found) {
          const item = stack.pop()!
          close(item, line, stack.length === found)
          if (!nodes[item.index]!.closed) {
            // an inner component left open ends before this closer
            nodes[item.index]!.endLine = line.number - 1
          }
        }
      }
      continue
    }

    const slot = /^#([A-Za-z][\w-]*)(\{.*)?$/.exec(body)
    if (slot && frame?.kind === 'component') {
      const attrs = slot[2] ? { from: bodyFrom + 1 + slot[1]!.length, to: bodyFrom + body.length, text: slot[2] } : undefined
      push({ kind: 'slot', name: slot[1]!, attrs, from: bodyFrom, to: bodyFrom + body.length, contentFrom: Math.min(length, line.to + 1), contentTo: bodyFrom + body.length, line: line.number, endLine: line.number, closed: true })
      continue
    }

    const heading = /^(#{1,6})(?:[ \t]+(.*))?$/.exec(body)
    if (heading && (heading[2] !== undefined || body.length === heading[1]!.length)) {
      push({ kind: 'heading', name: headingText(heading[2] ?? '').text, from: bodyFrom, to: length, contentFrom: Math.min(length, line.to + 1), contentTo: length, line: line.number, endLine: lines.length, level: heading[1]!.length, closed: true })
    }
  }

  // sections: a heading ends before the next heading of the same or a higher level
  const headings = nodes.filter(n => n.kind === 'heading')
  // one backward pass: the next heading of each level at or above
  const nextAt: (OutlineNode | undefined)[] = Array.from({ length: 7 })
  for (let i = headings.length - 1; i >= 0; i--) {
    const node = headings[i]!
    let next: OutlineNode | undefined
    for (let level = 1; level <= node.level!; level++) {
      const h = nextAt[level]
      if (h && (!next || h.from < next.from)) next = h
    }
    node.to = next ? Math.max(node.from, next.from - 1) : length
    node.contentTo = node.to
    node.endLine = next ? next.line - 1 : lines.length
    nextAt[node.level!] = node
  }

  // ids
  const idStack: { level: number, id: string }[] = []
  const counts = new Map<string, number>()
  for (const node of headings) {
    const raw = lines[node.line - 1]!.text.replace(LEAD, '').replace(/^#{1,6}[ \t]*/, '')
    const { text, explicitId } = headingText(raw)
    let slug = slugify(text)
    while (idStack.length && idStack.at(-1)!.level >= node.level!) idStack.pop()
    const parent = idStack.at(-1)
    if (parent && parent.level >= 2) slug = `${parent.id}-${slug}`
    idStack.push({ level: node.level!, id: slug })
    const count = counts.get(slug) ?? 0
    counts.set(slug, count + 1)
    node.id = explicitId ?? (count === 0 ? slug : `${slug}-${count}`)
  }

  return nodes
}
