/**
 * The agent API. Everything is a pure function of an `EditorState` that
 * returns data or an `Edit` (a CodeMirror change spec), so it runs in Node
 * and in the browser. `tools()` wraps them for an agent loop, and
 * `complete()` answers "what is valid here?" with the same items a user sees.
 */
import type { EditorState, TransactionSpec } from '@codemirror/state'
import type { CommandDef, Edit, EditError, JSONSchema, ResolvedConfig } from '../types.ts'
import type { OutlineNode } from '../document/outline.ts'
import { EditorSelection } from '@codemirror/state'
import { coreCommands } from '../commands/catalog.ts'
import { complete } from '../complete/engine.ts'
import { configOf } from '../config.ts'
import { docIndex } from '../document/index.ts'
import { diagnose } from '../lint.ts'

export { complete }
export { coreCommands } from '../commands/catalog.ts'

// #region targets

/** Structural targets: agents address content by structure, not offsets. */
export type Target =
  | { line: number }
  | { lines: [number, number] }
  | { heading: string, occurrence?: number }
  | { section: string, occurrence?: number }
  | { component: string, index?: number, where?: Record<string, unknown> }
  | { slot: string, component?: string }
  | { frontmatter: string }
  | { text: string, occurrence?: number }
  | { range: [number, number] }

export interface Resolved {
  from: number
  to: number
  /** Inside the block (after the opener, before the closer). */
  contentFrom: number
  contentTo: number
  line: number
  endLine: number
}

export const TARGET_SCHEMA: JSONSchema = {
  description: 'What to edit: `{ line }`, `{ lines: [a, b] }` (1-based), `{ heading }` (the heading line), `{ section }` (a heading and its content), `{ component, index?, where? }`, `{ slot, component? }`, `{ frontmatter: key }`, `{ text, occurrence? }` or `{ range: [from, to] }`.',
  type: 'object',
}

const fail = (code: string, message: string, candidates?: { line: number, excerpt: string }[]): EditError => ({ ok: false, code, message, candidates })

const lineSpan = (state: EditorState, a: number, b: number): Resolved => {
  const first = state.doc.line(a)
  const last = state.doc.line(b)
  return { from: first.from, to: last.to, contentFrom: first.from, contentTo: last.to, line: a, endLine: b }
}

function pick<T extends { line: number }>(hits: T[], what: string, n?: number, describe: (h: T) => string = () => what): T | EditError {
  if (n !== undefined) return hits[n - 1] ?? fail('not_found', `There is no occurrence ${n} of ${what}.`)
  if (hits.length === 1) return hits[0]!
  if (!hits.length) return fail('not_found', `There is no ${what}.`)
  return fail('ambiguous', `${what} occurs ${hits.length} times. Pass an occurrence or index.`, hits.map(h => ({ line: h.line, excerpt: describe(h) })))
}

export function resolveTarget(state: EditorState, target: Target): Resolved | EditError {
  const doc = state.doc
  const index = docIndex(state)
  const inDoc = (n: number) => Number.isInteger(n) && n >= 1 && n <= doc.lines
  if ('line' in target) return inDoc(target.line) ? lineSpan(state, target.line, target.line) : fail('not_found', `Line ${target.line} is outside the document (1–${doc.lines}).`)
  if ('lines' in target) {
    const [a, b] = target.lines
    return inDoc(a) && inDoc(b) && a <= b ? lineSpan(state, a, b) : fail('not_found', `Lines ${a}–${b} are outside the document (1–${doc.lines}).`)
  }
  if ('range' in target) {
    const [from, to] = target.range
    if (from < 0 || to > doc.length || from > to) return fail('not_found', 'The range is outside the document.')
    return { from, to, contentFrom: from, contentTo: to, line: doc.lineAt(from).number, endLine: doc.lineAt(to).number }
  }
  if ('text' in target) {
    const text = doc.toString()
    const hits: { line: number, at: number }[] = []
    for (let at = text.indexOf(target.text); at >= 0 && target.text; at = text.indexOf(target.text, at + 1)) hits.push({ line: doc.lineAt(at).number, at })
    const hit = pick(hits, `"${target.text}"`, target.occurrence, h => doc.line(h.line).text.slice(0, 80))
    if ('ok' in hit) return hit
    return { from: hit.at, to: hit.at + target.text.length, contentFrom: hit.at, contentTo: hit.at + target.text.length, line: hit.line, endLine: doc.lineAt(hit.at + target.text.length).number }
  }
  if ('heading' in target || 'section' in target) {
    const want = ('heading' in target ? target.heading : target.section).replace(/^#+\s*/, '').trim().toLowerCase()
    const hits = index.outline.filter(n => n.kind === 'heading' && (n.name.toLowerCase() === want || n.id === want))
    const hit = pick(hits, `heading "${want}"`, target.occurrence, h => h.name)
    if ('ok' in hit) return hit
    const line = doc.line(hit.line)
    if ('heading' in target) return { from: line.from, to: line.to, contentFrom: line.from, contentTo: line.to, line: hit.line, endLine: hit.line }
    return { from: line.from, to: hit.to, contentFrom: Math.min(line.to + 1, hit.to), contentTo: hit.to, line: hit.line, endLine: hit.endLine }
  }
  if ('slot' in target) {
    const hits = index.outline.filter(n => n.kind === 'slot' && n.name === target.slot && (!target.component || index.outline[n.parent!]?.name === target.component))
    const hit = pick(hits, `slot "#${target.slot}"`, undefined, h => index.outline[h.parent!]?.name ?? '')
    if ('ok' in hit) return hit
    // a slot runs until the next slot of the same component, or the closer
    const owner = index.outline[hit.parent!]!
    const next = index.outline.find(n => n.kind === 'slot' && n.parent === hit.parent && n.line > hit.line)
    const endLine = next ? next.line - 1 : owner.closed ? owner.endLine - 1 : owner.endLine
    const line = doc.line(hit.line)
    const end = doc.line(Math.max(hit.line, endLine))
    return { from: line.from, to: end.to, contentFrom: Math.min(line.to + 1, end.to), contentTo: end.to, line: hit.line, endLine }
  }
  if ('component' in target) {
    let hits = index.outline.filter(n => n.kind === 'component' && n.name === target.component)
    if (target.where) {
      const where = Object.entries(target.where)
      hits = hits.filter((n) => {
        const props = index.propsOf(n)
        return where.every(([k, v]) => String(props[k] ?? props[`:${k}`]) === String(v))
      })
    }
    const hit = target.index !== undefined ? hits[target.index] ?? fail('not_found', `There is no component "${target.component}" at index ${target.index}.`) : pick(hits, `component "${target.component}"`, undefined, h => doc.line(h.line).text.slice(0, 80))
    if ('ok' in hit) return hit
    return blockSpan(state, hit)
  }
  if ('frontmatter' in target) {
    const fm = index.frontmatter.node
    if (!fm) return fail('not_found', 'The document has no frontmatter.')
    for (let l = fm.line + 1; l < fm.endLine; l++) {
      if (!doc.line(l).text.startsWith(`${target.frontmatter}:`)) continue
      let end = l
      while (end + 1 < fm.endLine && /^\s+\S|^\s*-\s/.test(doc.line(end + 1).text)) end++
      return lineSpan(state, l, end)
    }
    return fail('not_found', `There is no frontmatter key "${target.frontmatter}".`)
  }
  return fail('bad_param', 'Unknown target.')
}

function blockSpan(state: EditorState, node: OutlineNode): Resolved {
  const doc = state.doc
  const open = doc.line(node.line)
  const end = doc.line(node.endLine)
  const bodyLine = node.props?.closed ? node.props.endLine + 2 : node.line + 1
  const contentFrom = bodyLine <= doc.lines ? Math.min(doc.line(bodyLine).from, end.from) : open.to
  const contentTo = node.closed ? Math.max(contentFrom, end.from - 1) : end.to
  return { from: open.from, to: end.to, contentFrom, contentTo, line: node.line, endLine: node.endLine }
}

// #endregion

// #region edits

export type EditMode = 'replace' | 'before' | 'after' | 'prepend' | 'append'

/** `str_replace` semantics: the search text must be unique unless `occurrence` or `all` is given. */
export function replace(state: EditorState, params: { search: string, replace: string, occurrence?: number, all?: boolean }): Edit {
  if (!params.search) return fail('bad_param', 'The search text is empty.')
  const text = state.doc.toString()
  const hits: number[] = []
  for (let at = text.indexOf(params.search); at >= 0; at = text.indexOf(params.search, at + params.search.length)) hits.push(at)
  if (!hits.length) return fail('not_found', 'The search text does not occur in the document.')
  const change = (at: number) => ({ from: at, to: at + params.search.length, insert: params.replace })
  if (params.all) return { ok: true, changes: hits.map(change) }
  const hit = pick(hits.map(at => ({ at, line: state.doc.lineAt(at).number })), 'The search text', params.occurrence, h => state.doc.line(h.line).text.slice(0, 80))
  return 'ok' in hit ? hit : { ok: true, changes: change(hit.at) }
}

/** Replace a target, or insert content before/after it or at the start/end of its content. */
export function edit(state: EditorState, params: { target: Target, mode?: EditMode, content: string }): Edit {
  const r = resolveTarget(state, params.target)
  if ('ok' in r) return r
  const mode = params.mode ?? 'replace'
  const content = params.content
  switch (mode) {
    case 'replace': return { ok: true, changes: { from: r.from, to: r.to, insert: content } }
    case 'before': return { ok: true, changes: { from: r.from, insert: content.endsWith('\n') ? content : `${content}\n` } }
    case 'after': return { ok: true, changes: { from: r.to, insert: content.startsWith('\n') ? content : `\n${content}` } }
    case 'prepend': return { ok: true, changes: { from: r.contentFrom, insert: content.endsWith('\n') ? content : `${content}\n` } }
    case 'append': return { ok: true, changes: { from: r.contentTo, insert: r.contentTo > r.contentFrom ? `\n${content.replace(/\n$/, '')}` : content.replace(/\n$/, '') } }
    default: return fail('bad_param', `Unknown mode "${String(mode)}".`)
  }
}

/** Replace the whole text with the smallest single change (common prefix and suffix kept). */
export function setText(state: EditorState, text: string): Edit {
  const old = state.doc.toString()
  if (old === text) return fail('no_op', 'The text is unchanged.')
  let start = 0
  const max = Math.min(old.length, text.length)
  while (start < max && old.charCodeAt(start) === text.charCodeAt(start)) start++
  let end = 0
  while (end < max - start && old.charCodeAt(old.length - 1 - end) === text.charCodeAt(text.length - 1 - end)) end++
  return { ok: true, changes: { from: start, to: old.length - end, insert: text.slice(start, text.length - end) } }
}

/** Apply a unified diff (no fuzz). Hunks that do not match exactly fail with their index. */
export function patch(state: EditorState, diff: string): Edit {
  const lines = state.doc.toString().split('\n')
  const hunks: { old: number, remove: string[], add: string[] }[] = []
  let cur: (typeof hunks)[number] | undefined
  for (const raw of diff.replace(/\n$/, '').split('\n')) {
    const header = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/.exec(raw)
    if (header) {
      cur = { old: Number(header[1]), remove: [], add: [] }
      hunks.push(cur)
      continue
    }
    if (!cur || raw.startsWith('---') || raw.startsWith('+++') || raw.startsWith('\\')) continue
    const body = raw.slice(1)
    if (raw.startsWith('-')) cur.remove.push(body)
    else if (raw.startsWith('+')) cur.add.push(body)
    else if (raw.startsWith(' ') || raw === '') {
      cur.remove.push(body)
      cur.add.push(body)
    }
  }
  if (!hunks.length) return fail('bad_param', 'The diff has no hunks.')
  const changes: { from: number, to: number, insert: string }[] = []
  for (const [i, h] of hunks.entries()) {
    const matchesAt = (start: number) => h.remove.every((l, j) => lines[start + j] === l)
    let start = Math.max(0, h.old - 1)
    if (h.remove.length && !matchesAt(start)) {
      const all = lines.map((_, s) => s).filter(matchesAt)
      if (all.length !== 1) return fail('conflict', `Hunk ${i + 1} does not match the document${all.length > 1 ? ' uniquely' : ''}.`)
      start = all[0]!
    }
    const from = start < lines.length ? state.doc.line(start + 1).from : state.doc.length
    const endLine = start + h.remove.length
    const to = h.remove.length ? state.doc.line(endLine).to : from
    const insert = h.add.join('\n') + (h.remove.length ? '' : '\n')
    changes.push({ from, to, insert })
  }
  return { ok: true, changes }
}

/** Run a registered command. `params.target` moves the selection to a target first. */
/** Core commands plus every plugin's commands. */
export function commandsOf(config: ResolvedConfig): Map<string, CommandDef> {
  return new Map([...coreCommands, ...config.commands.values()].map(c => [c.name, c]))
}

export function runCommand(state: EditorState, name: string, params: Record<string, unknown> = {}): Edit {
  const config = configOf(state)
  const commands = commandsOf(config)
  const command = commands.get(name)
  if (!command) return fail('unknown_command', `Unknown command "${name}". Known: ${[...commands.keys()].join(', ')}.`)
  let at = state
  if (params.target) {
    const r = resolveTarget(state, params.target as Target)
    if ('ok' in r) return r
    at = state.update({ selection: EditorSelection.single(r.from, r.to) }).state
  }
  return command.run(at, params, config)
}

// #endregion

// #region context

export interface Snapshot {
  /** The text with 1-based line numbers (`12│ text`). */
  text: string
  lines: number
  outline: { kind: string, name: string, line: number, endLine: number, level?: number, id?: string }[]
  frontmatter: Record<string, unknown>
  diagnostics: { line: number, severity: string, message: string, source?: string }[]
  selection: { from: number, to: number, line: number }
}

/** Compact JSON context for a prompt. `around` limits the text to a window around a target. */
export function snapshot(state: EditorState, options: { around?: Target, context?: number } = {}): Snapshot {
  const index = docIndex(state)
  const doc = state.doc
  let [a, b] = [1, doc.lines]
  if (options.around) {
    const r = resolveTarget(state, options.around)
    if (!('ok' in r)) [a, b] = [Math.max(1, r.line - (options.context ?? 5)), Math.min(doc.lines, r.endLine + (options.context ?? 5))]
  }
  const width = String(b).length
  const text: string[] = []
  for (let n = a; n <= b; n++) text.push(`${String(n).padStart(width)}│ ${doc.line(n).text}`)
  const main = state.selection.main
  return {
    text: text.join('\n'),
    lines: doc.lines,
    outline: index.outline.map(n => ({ kind: n.kind, name: n.name, line: n.line, endLine: n.endLine, ...(n.level ? { level: n.level } : {}), ...(n.id ? { id: n.id } : {}) })),
    frontmatter: index.frontmatter.value,
    diagnostics: diagnose(state).map(d => ({ line: doc.lineAt(d.from).number, severity: d.severity, message: d.message, source: d.source })),
    selection: { from: main.from, to: main.to, line: doc.lineAt(main.head).number },
  }
}

/** A Markdown cheat sheet of the syntax this editor supports (plugins + component manifest). */
export function llms(state: EditorState, config: ResolvedConfig = configOf(state)): string {
  const parts = ['# Comark syntax for this document', '', 'Comark is Markdown (CommonMark + GFM) with components, attributes and bindings.', '']
  for (const plugin of config.plugins) if (plugin.llms) parts.push(`- ${plugin.llms.split('\n').join('\n  ')}`)
  const components = [...config.components.values()]
  if (components.length) {
    parts.push('', '## Components', '')
    for (const def of components) {
      const props = Object.entries(def.props ?? {}).map(([n, p]) => `\`${n}\`${p.enum ? ` (${p.enum.join(' | ')})` : p.type ? ` (${p.type})` : ''}${p.required ? ' required' : ''}`)
      const slots = (def.slots ?? []).filter(s => s.name !== 'default').map(s => `\`#${s.name}\``)
      parts.push(`- \`${def.kind === 'inline' ? ':' : '::'}${def.name}\`${def.description ? ` — ${def.description}` : ''}${props.length ? `. Props: ${props.join(', ')}` : ''}${slots.length ? `. Slots: ${slots.join(', ')}` : ''}`)
    }
  }
  return parts.join('\n')
}

// #endregion

// #region tools

export interface Tool {
  name: string
  description: string
  inputSchema: JSONSchema
  execute: (params: Record<string, unknown>) => Promise<unknown>
}

/** Something that holds the current state and applies changes (an `EditorView` works). */
export interface ToolTarget {
  readonly state: EditorState
  dispatch: (spec: TransactionSpec) => void
}

function apply(target: ToolTarget, result: Edit) {
  if (!result.ok) return result
  target.dispatch({ changes: result.changes, selection: result.selection, userEvent: 'agent', scrollIntoView: true })
  return { ok: true, lines: target.state.doc.lines }
}

const commandTool = (target: ToolTarget, command: CommandDef): Tool => ({
  name: command.name,
  description: command.description,
  inputSchema: {
    type: 'object',
    properties: { ...(command.params?.properties ?? {}), target: TARGET_SCHEMA },
    required: command.params?.required,
  },
  execute: async params => apply(target, runCommand(target.state, command.name, params)),
})

/**
 * Tools for an agent loop: read (`snapshot`, `complete`, `llms`), edit
 * (`replace`, `edit`, `patch`, `setText`) and every command. Edits are
 * dispatched with `userEvent: 'agent'`, so they undo like any other change.
 */
export function tools(target: ToolTarget): Tool[] {
  const config = configOf(target.state)
  const base: Tool[] = [
    {
      name: 'read',
      description: 'Read the document: numbered lines, outline, frontmatter, diagnostics and selection. Pass `around` to read a window around a target.',
      inputSchema: { type: 'object', properties: { around: TARGET_SCHEMA, context: { type: 'integer' } } },
      execute: async p => snapshot(target.state, { around: p.around as Target | undefined, context: typeof p.context === 'number' ? p.context : undefined }),
    },
    {
      name: 'complete',
      description: 'What is valid at a position: the completion context (e.g. `attr-key` of `::card`) and the items (components, props, values, slots, binding paths…). Give `line` and `column` (1-based) or `offset`.',
      inputSchema: { type: 'object', properties: { line: { type: 'integer' }, column: { type: 'integer' }, offset: { type: 'integer' } } },
      execute: async (p) => {
        const doc = target.state.doc
        const pos = typeof p.offset === 'number' ? p.offset : typeof p.line === 'number' ? Math.min(doc.line(p.line).from + Math.max(0, Number(p.column ?? 1) - 1), doc.line(p.line).to) : target.state.selection.main.head
        const res = await complete(target.state, pos, { explicit: true })
        return res ? { context: { kind: res.context.kind, typed: res.context.typed }, items: res.items.slice(0, 100) } : { context: null, items: [] }
      },
    },
    {
      name: 'syntax',
      description: 'The Comark syntax and components this document supports (Markdown).',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => llms(target.state, config),
    },
    {
      name: 'replace',
      description: 'Replace text. The search text must be unique unless `occurrence` (1-based) or `all` is given; ambiguous matches return candidates.',
      inputSchema: { type: 'object', properties: { search: { type: 'string' }, replace: { type: 'string' }, occurrence: { type: 'integer' }, all: { type: 'boolean' } }, required: ['search', 'replace'] },
      execute: async p => apply(target, replace(target.state, p as never)),
    },
    {
      name: 'edit',
      description: 'Edit a structural target: `replace` it, insert `before`/`after` it, or `prepend`/`append` inside it (e.g. inside a component or section).',
      inputSchema: { type: 'object', properties: { target: TARGET_SCHEMA, mode: { enum: ['replace', 'before', 'after', 'prepend', 'append'] }, content: { type: 'string' } }, required: ['target', 'content'] },
      execute: async p => apply(target, edit(target.state, p as never)),
    },
    {
      name: 'patch',
      description: 'Apply a unified diff to the document (exact context).',
      inputSchema: { type: 'object', properties: { diff: { type: 'string' } }, required: ['diff'] },
      execute: async p => apply(target, patch(target.state, String(p.diff ?? ''))),
    },
    {
      name: 'setText',
      description: 'Replace the whole document. Only the changed middle part is replaced, so cursors and history elsewhere survive.',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      execute: async p => apply(target, setText(target.state, String(p.text ?? ''))),
    },
  ]
  return [...base, ...[...commandsOf(config).values()].map(c => commandTool(target, c))]
}

// #endregion
