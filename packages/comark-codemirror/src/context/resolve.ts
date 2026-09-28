/**
 * `resolveContext(state, pos)`: the one place that decides what the cursor
 * is on. Block context comes from the document index (frontmatter, props
 * blocks, fences, math, the component stack); code spans and comments come
 * from the syntax tree; inline context comes from a scan of the line prefix,
 * which works on incomplete input like `::card{ti`.
 */
import type { EditorState } from '@codemirror/state'
import type { OutlineNode } from '../document/outline.ts'
import type { AttrOwner, CursorContext } from './types.ts'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { attrCursor } from '../document/attributes.ts'
import { docIndex } from '../document/index.ts'
import { LEAD } from '../document/outline.ts'
import { yamlCursor } from '../document/yaml.ts'

export interface ResolveOptions {
  /** The user asked for completion (Ctrl-Space): also answer on empty lines and mid-line. */
  explicit?: boolean
  /** `/` at the start of a line opens the block menu. @default true */
  slash?: boolean
}

const QUIET_NODES = new Set(['InlineCode', 'CodeBlock', 'CommentBlock', 'Comment', 'Autolink', 'URL', 'HTMLTag', 'ProcessingInstructionBlock'])

/** Inside inline code, an indented code block, an HTML comment or a URL. */
function inQuietNode(state: EditorState, pos: number): boolean {
  const tree = ensureSyntaxTree(state, pos, 25) ?? syntaxTree(state)
  for (let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, -1); node; node = node.parent) {
    if (QUIET_NODES.has(node.name) && node.from < pos && pos < node.to) return true
    if (node.name === 'CodeBlock' && node.from < pos) return true
  }
  return false
}

/** The open `{` (attributes) or `{{` (binding) the cursor is in, scanning the line prefix. */
function openBrace(before: string): { attr: number } | { binding: number } | null {
  let attr = -1
  let binding = -1
  let quote = ''
  for (let i = 0; i < before.length; i++) {
    const c = before[i]
    if (attr >= 0) {
      if (quote) {
        if (c === quote) quote = ''
      }
      else if (c === '"' || c === '\'') quote = c
      else if (c === '}') attr = -1
      continue
    }
    if (binding >= 0) {
      if (c === '}' && before[i + 1] === '}') {
        binding = -1
        i++
      }
      continue
    }
    if (c === '{' && before[i - 1] !== '\\') {
      if (before[i + 1] === '{') {
        binding = i
        i++
      }
      else attr = i
    }
  }
  return binding >= 0 ? { binding } : attr >= 0 ? { attr } : null
}

function attrOwner(head: string, lineNode: OutlineNode | undefined, stack: readonly OutlineNode[]): AttrOwner | null {
  const lead = LEAD.exec(head)?.[0] ?? ''
  const body = head.slice(lead.length)
  const block = /^(:{2,})([A-Za-z$][\w$.-]*)(\[[^\]]*\])?$/.exec(body)
  if (block) return { type: 'component', name: block[2]!, inline: false, node: lineNode?.kind === 'component' ? lineNode : undefined }
  const inline = /(?<![\w:]):([A-Za-z][\w-]*)(\[[^\]]*\])?$/.exec(head)
  if (inline) return { type: 'component', name: inline[1]!, inline: true }
  const slot = /^#([A-Za-z][\w-]*)$/.exec(body)
  if (slot && stack.length) return { type: 'slot', name: slot[1]!, component: stack.at(-1) }
  if (/!\[[^\]]*\]\([^)]*\)$/.test(head)) return { type: 'image' }
  if (/\]\([^)]*\)$/.test(head)) return { type: 'link' }
  if (/\]$/.test(head)) return { type: 'span' }
  if (/(?:\*\*|__|\*|_|~~)$/.test(head)) return { type: 'mark' }
  if (/`$/.test(head)) return { type: 'code' }
  if (/^#{1,6}[ \t].*[ \t]$/.test(body)) return { type: 'heading' }
  return null
}

export function resolveContext(state: EditorState, pos: number, options: ResolveOptions = {}): CursorContext | null {
  const explicit = options.explicit ?? false
  const index = docIndex(state)
  const line = state.doc.lineAt(pos)
  const before = line.text.slice(0, pos - line.from)
  const stack = index.stackAt(line.number)
  const at = (from: number) => ({ from, to: pos, typed: state.sliceDoc(from, pos), pos, line: line.number, stack })
  const back = (text: string) => at(pos - text.length)

  // fence / math / frontmatter closers and props fences are not completable
  for (const node of index.outline) {
    if (node.closed && node.endLine === line.number && node.line !== line.number && (node.kind === 'fence' || node.kind === 'math' || node.kind === 'frontmatter')) return null
    if (node.props && (line.number === node.props.line - 1 || (node.props.closed && line.number === node.props.endLine + 1))) return null
  }

  const region = index.regionAt(line.number)
  if (region?.kind === 'frontmatter' || region?.kind === 'props') {
    const first = region.kind === 'frontmatter' ? region.node.line + 1 : region.node.props!.line
    const lines: string[] = []
    for (let l = first; l < line.number; l++) lines.push(state.doc.line(l).text)
    const lead = region.kind === 'props' ? (LEAD.exec(before)?.[0].replace(/[^ \t]/g, ' ') ?? '') : ''
    const cur = yamlCursor(lines.map(l => l.slice(Math.min(lead.length, l.length - l.trimStart().length))), before.slice(lead.length))
    if (!cur) return null
    if (region.kind === 'frontmatter') {
      if (cur.at === 'key') return { kind: 'frontmatter-key', ...back(cur.typed), path: cur.path, present: cur.present }
      if (cur.at === 'value') return { kind: 'frontmatter-value', ...back(cur.typed), path: cur.path, key: cur.key }
      return { kind: 'frontmatter-value', ...back(cur.typed), path: cur.path.slice(0, -1), key: cur.path.at(-1) ?? '' }
    }
    const component = region.node
    if (cur.at === 'key') return { kind: 'props-key', ...back(cur.typed), component, path: cur.path, present: cur.present }
    if (cur.at === 'value') return { kind: 'props-value', ...back(cur.typed), component, path: cur.path, key: cur.key }
    return { kind: 'props-value', ...back(cur.typed), component, path: cur.path.slice(0, -1), key: cur.path.at(-1) ?? '' }
  }
  if (region?.kind === 'fence') {
    return { kind: 'fence-body', ...back(/[\w-]*$/.exec(before)![0]), lang: region.node.name }
  }
  if (region?.kind === 'math') {
    const cmd = /\\[A-Za-z]*$/.exec(before)
    return cmd ? { kind: 'math', ...back(cmd[0]), display: true } : null
  }

  const lineNode = index.outline.find(n => n.line === line.number && n.kind !== 'heading')
  if (lineNode?.kind === 'fence') {
    const lang = /^(?:`{3,}|~{3,})([^\s{[]*)$/.exec(before.slice(LEAD.exec(before)?.[0].length ?? 0))
    if (lang) return { kind: 'fence-lang', ...back(lang[1]!) }
    const meta = /^(?:`{3,}|~{3,})([^\s{[]+)[ \t]+(?:.*[ \t])?(\S*)$/.exec(before.slice(LEAD.exec(before)?.[0].length ?? 0))
    if (meta) return { kind: 'fence-meta', ...back(meta[2]!), lang: meta[1]! }
    return null
  }

  if (inQuietNode(state, pos)) return null

  // attribute blocks and bindings
  const brace = openBrace(before)
  if (brace && 'binding' in brace) {
    const inner = before.slice(brace.binding + 2)
    const or = inner.indexOf('||')
    if (or >= 0) {
      const typed = inner.slice(or + 2).trimStart()
      return { kind: 'binding-default', ...back(typed), path: inner.slice(0, or).trim() }
    }
    const path = inner.trimStart()
    if (/\s/.test(path.trimEnd()) || !/^[\w$.-]*\s*$/.test(path)) return null
    if (/\s$/.test(path) && path.trim()) return { kind: 'binding-default', ...back(''), path: path.trim() }
    const segments = path.split('.')
    return { kind: 'binding-path', ...back(segments.at(-1)!), mode: 'interpolation', segments: segments.slice(0, -1) }
  }
  if (brace && 'attr' in brace) {
    const owner = attrOwner(before.slice(0, brace.attr), lineNode, stack)
    const cur = owner ? attrCursor(before.slice(brace.attr + 1)) : null
    if (owner && cur) {
      if (cur.at === 'key') return { kind: 'attr-key', ...back(cur.typed), owner, prefix: cur.prefix, present: cur.present, separated: cur.separated }
      if (cur.at === 'class') return { kind: 'attr-class', ...back(cur.typed), owner, present: cur.present }
      if (cur.at === 'id') return { kind: 'attr-id', ...back(cur.typed), owner, present: cur.present }
      if (cur.prefix === ':' || cur.prefix === '::') {
        if (!/^[\w$.-]*$/.test(cur.typed)) return null
        const segments = cur.typed.split('.')
        return { kind: 'binding-path', ...back(segments.at(-1)!), mode: cur.prefix === '::' ? 'model' : 'bound', segments: segments.slice(0, -1), owner, key: cur.name }
      }
      return { kind: 'attr-value', ...back(cur.typed), owner, key: cur.key, name: cur.name, present: cur.present }
    }
    if (owner) return null
  }

  const lead = LEAD.exec(before)?.[0] ?? ''
  const body = before.slice(lead.length)

  // line-start constructs
  const opener = /^(:{2,})([A-Za-z$][\w$.-]*)?$/.exec(body)
  if (opener) {
    const colons = opener[1]!.length
    // the component this line would close: an open one, or the one this `::` already closes
    const closer = opener[2]
      ? undefined
      : [...stack].reverse().find(n => n.colons === colons) ?? index.outline.find(n => n.kind === 'component' && n.closed && n.endLine === line.number && n.colons === colons)
    return { kind: 'component-name', ...back(body), inline: false, colons, closer }
  }
  if (stack.length && /^#(?:[A-Za-z][\w-]*)?$/.test(body)) return { kind: 'slot', ...back(body), component: stack.at(-1)! }
  const alert = /^[ \t]*>[ \t]*(\[!?\w*)$/.exec(before)
  if (alert) return { kind: 'alert', ...back(alert[1]!) }
  const task = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+(\[[ xX]?)$/.exec(before)
  if (task) return { kind: 'task', ...back(task[1]!) }
  if ((options.slash ?? true) && /^\/[\w-]*$/.test(body)) return { kind: 'block', ...back(body.slice(1)), slash: true }
  if (line.number === 1 && before === '---' && !index.frontmatter.node) return { kind: 'block', ...back(before), slash: false }

  // inline constructs
  const footnote = /\[\^([^\]\s]*)$/.exec(before)
  if (footnote) return { kind: 'footnote', ...back(footnote[1]!) }
  const link = /(!?)\[[^\]]*\]\(([^)\s]*)$/.exec(before)
  if (link) return { kind: 'link-url', ...back(link[2]!), image: link[1] === '!', anchor: link[2]!.startsWith('#') }
  const colon = /(?<![\w:\\]):([\w+-]*)$/.exec(before)
  if (colon) {
    const typed = `:${colon[1]}`
    if (/^(?:[A-Za-z][\w-]*)?$/.test(colon[1]!)) return { kind: 'component-name', ...back(typed), inline: true, colons: 1 }
    return { kind: 'emoji', ...back(typed) }
  }
  const tag = /<(\/?)([A-Za-z][\w-]*)?$/.exec(before)
  if (tag) return { kind: 'html-tag', ...back(tag[0]), closing: tag[1] === '/' }
  const attr = /<([A-Za-z][\w-]*)(?:[ \t]+[^<>]*)?[ \t]([\w:@-]*)$/.exec(before)
  if (attr) return { kind: 'html-attr', ...back(attr[2]!), tag: attr[1]!.toLowerCase() }
  const dollars = (before.match(/(?<!\\)\$/g) ?? []).length
  const cmd = /\\[A-Za-z]*$/.exec(before)
  if (cmd && dollars % 2 === 1) return { kind: 'math', ...back(cmd[0]), display: /\$\$[^$]*$/.test(before) }

  if (!explicit) return null
  if (!body.trim()) return { kind: 'block', ...back(body.trimStart()), slash: false }
  return { kind: 'inline', ...back(/[\w-]*$/.exec(before)![0]) }
}
