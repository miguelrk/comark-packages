/**
 * The document index: outline, frontmatter data, headings, footnotes,
 * component props and values already used in the document. Computed lazily
 * once per document version (memoized on the immutable `Text`), so typing
 * costs nothing until a completion, lint or hover asks for it. Footnotes and
 * usages are scanned only when something reads them.
 */
import type { EditorState, Text } from '@codemirror/state'
import type { OutlineNode } from './outline.ts'
import { parseAttributes } from './attributes.ts'
import { LEAD, outline } from './outline.ts'
import { parseYaml } from './yaml.ts'

export interface Heading {
  id: string
  text: string
  level: number
  line: number
  from: number
}

export interface Footnote {
  id: string
  line: number
  text: string
  from: number
  to: number
}

export interface DocIndex {
  doc: Text
  outline: readonly OutlineNode[]
  frontmatter: { node?: OutlineNode, value: Record<string, unknown> }
  headings: readonly Heading[]
  footnotes: ReadonlyMap<string, Footnote>
  footnoteRefs: readonly { id: string, from: number, to: number }[]
  /** Names, prop values, classes and ids already written in this document. */
  usages: {
    components: ReadonlySet<string>
    values: ReadonlyMap<string, ReadonlySet<string>>
    classes: ReadonlySet<string>
    ids: ReadonlySet<string>
  }
  /** Open components around a line (outermost first). A component opened on `line` is not included. */
  stackAt: (line: number) => OutlineNode[]
  /** The innermost region that is not Markdown (frontmatter, props block, fence, math) containing `line`. */
  regionAt: (line: number) => { kind: 'frontmatter' | 'props' | 'fence' | 'math', node: OutlineNode } | undefined
  /** A component's props: its attribute block, then its YAML props block. Keys keep `:`/`::` prefixes. */
  propsOf: (node: OutlineNode) => Record<string, unknown>
}

const cache = new WeakMap<Text, DocIndex>()

export function docIndex(state: EditorState | Text): DocIndex {
  const doc = 'doc' in state ? state.doc : state
  let index = cache.get(doc)
  if (!index) {
    index = buildIndex(doc)
    cache.set(doc, index)
  }
  return index
}

function linesText(doc: Text, from: number, to: number): string[] {
  const out: string[] = []
  for (let l = from; l <= to && l <= doc.lines; l++) out.push(doc.line(l).text)
  return out
}

function buildIndex(doc: Text): DocIndex {
  const nodes = outline(doc)
  const fmNode = nodes.find(n => n.kind === 'frontmatter' && n.closed)
  let fmValue: Record<string, unknown> = {}
  if (fmNode) {
    const value = parseYaml(linesText(doc, fmNode.line + 1, fmNode.endLine - 1))
    if (value && typeof value === 'object' && !Array.isArray(value)) fmValue = value as Record<string, unknown>
  }

  const headings: Heading[] = nodes
    .filter(n => n.kind === 'heading')
    .map(n => ({ id: n.id!, text: n.name, level: n.level!, line: n.line, from: n.from }))

  // lines inside frontmatter, fences and math (no Markdown there)
  const code = new Uint8Array(doc.lines + 2)
  for (const n of nodes) {
    if (n.kind !== 'frontmatter' && n.kind !== 'fence' && n.kind !== 'math') continue
    for (let l = n.line + 1; l < (n.closed ? n.endLine : n.endLine + 1); l++) code[l] = 1
  }

  const propsCache = new Map<OutlineNode, Record<string, unknown>>()
  const propsOf = (node: OutlineNode): Record<string, unknown> => {
    let props = propsCache.get(node)
    if (props) return props
    props = {}
    if (node.attrs) {
      for (const entry of parseAttributes(node.attrs.text)) props[entry.key] = entry.value
    }
    if (node.props) {
      const value = parseYaml(linesText(doc, node.props.line, node.props.endLine))
      if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(props, value)
    }
    propsCache.set(node, props)
    return props
  }

  // footnotes and usages need a pass over the text: computed on first use
  let scanned: Pick<DocIndex, 'footnotes' | 'footnoteRefs' | 'usages'> | undefined
  const scan = () => {
    if (scanned) return scanned
    const footnotes = new Map<string, Footnote>()
    const footnoteRefs: { id: string, from: number, to: number }[] = []
    const classes = new Set<string>()
    const ids = new Set<string>()
    const components = new Set<string>()
    let l = 0
    let from = 0
    for (const text of doc.iterLines()) {
      l++
      const lineFrom = from
      from += text.length + 1
      if (code[l]) continue
      if (text.includes('[^')) {
        const def = /^\[\^([^\]\s]+)\]:[ \t]?(.*)$/.exec(text)
        if (def) footnotes.set(def[1]!, { id: def[1]!, line: l, text: def[2]!, from: lineFrom, to: lineFrom + text.length })
        for (const m of text.matchAll(/\[\^([^\]\s]+)\](?!:)/g)) footnoteRefs.push({ id: m[1]!, from: lineFrom + m.index, to: lineFrom + m.index + m[0].length })
      }
      if (text.includes('{')) {
        for (const m of text.matchAll(/\{(?!\{)[^{}\n]*\}/g)) {
          for (const entry of parseAttributes(m[0])) {
            if (entry.key === 'class' && typeof entry.value === 'string') entry.value.split(/\s+/).filter(Boolean).forEach(c => classes.add(c))
            if (entry.key === 'id' && typeof entry.value === 'string') ids.add(entry.value)
          }
        }
      }
      if (text.includes(':')) {
        for (const m of text.replace(LEAD, '').matchAll(/(?<![\w:]):([A-Za-z][\w-]*)(?=[[{\s]|$)/g)) components.add(m[1]!)
      }
    }
    const values = new Map<string, Set<string>>()
    for (const node of nodes) {
      if (node.kind !== 'component') continue
      components.add(node.name)
      for (const [key, value] of Object.entries(propsOf(node))) {
        if (typeof value !== 'string' || !value || key.startsWith(':')) continue
        const k = `${node.name}.${key}`
        if (!values.has(k)) values.set(k, new Set())
        values.get(k)!.add(value)
      }
    }
    return (scanned = { footnotes, footnoteRefs, usages: { components, values, classes, ids } })
  }

  const stackAt = (line: number): OutlineNode[] => nodes.filter(n =>
    n.kind === 'component' && n.line < line && (n.closed ? line < n.endLine : line <= n.endLine))

  const regionAt: DocIndex['regionAt'] = (line) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]!
      if (n.kind === 'component' && n.props && line >= n.props.line && line <= n.props.endLine) return { kind: 'props', node: n }
      if ((n.kind === 'frontmatter' || n.kind === 'fence' || n.kind === 'math') && line > n.line && (n.closed ? line < n.endLine : line <= n.endLine)) {
        return { kind: n.kind, node: n }
      }
    }
    return undefined
  }

  return {
    doc,
    outline: nodes,
    frontmatter: { node: fmNode, value: fmValue },
    headings,
    get footnotes() { return scan().footnotes },
    get footnoteRefs() { return scan().footnoteRefs },
    get usages() { return scan().usages },
    stackAt,
    regionAt,
    propsOf,
  }
}
