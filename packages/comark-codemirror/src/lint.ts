/**
 * Diagnostics: structure (unclosed blocks, stray closers), the component
 * manifest (unknown components, props, slots, enum values, required props)
 * and binding paths. Each comes with a quick fix where one is obvious.
 */
import type { Action, Diagnostic } from '@codemirror/lint'
import type { EditorState } from '@codemirror/state'
import type { LintContext, ResolvedConfig, ScopeRoot } from './types.ts'
import { scopesAt, shapeAt } from './bindings.ts'
import { configOf } from './config.ts'
import { parseAttributes } from './document/attributes.ts'
import { docIndex } from './document/index.ts'

/** Edit distance, for "did you mean". */
export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]!
}

export function closest(word: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined
  let score = Math.max(2, Math.floor(word.length / 3)) + 1
  for (const c of candidates) {
    const d = distance(word, c)
    if (d < score) {
      score = d
      best = c
    }
  }
  return best
}

const replaceWith = (name: string, text: string): Action => ({
  name,
  apply(view, from, to) {
    view.dispatch({ changes: { from, to, insert: text } })
  },
})

function structure({ state, index, config }: LintContext): Diagnostic[] {
  const out: Diagnostic[] = []
  const doc = state.doc
  const nodes = index.outline
  const first = doc.line(1)
  if (/^---[ \t]*$/.test(first.text) && !index.frontmatter.node) {
    let closer = false
    for (let l = 2; l <= doc.lines && !closer; l++) closer = /^(?:---|\.\.\.)[ \t]*$/.test(doc.line(l).text)
    if (!closer) out.push({ from: 0, to: first.to, severity: 'error', source: 'frontmatter', message: 'Frontmatter has no closing `---`.' })
  }
  const known = config.components
  for (const node of nodes) {
    const line = doc.line(node.line)
    if (!node.closed && (node.kind === 'component' || node.kind === 'fence' || node.kind === 'math')) {
      const closer = node.kind === 'component' ? ':'.repeat(node.colons!) : node.kind === 'math' ? '$$' : /^\s*(?:[-*+>]\s*)*(`{3,}|~{3,})/.exec(line.text)?.[1] ?? '```'
      out.push({
        from: node.from,
        to: line.to,
        severity: 'error',
        source: node.kind,
        message: node.kind === 'component' ? `\`::${node.name}\` is not closed.` : node.kind === 'fence' ? 'Code fence is not closed.' : 'Math block is not closed.',
        actions: [{ name: `Add ${closer}`, apply: view => view.dispatch({ changes: { from: view.state.doc.length, insert: `${view.state.doc.length && !view.state.doc.toString().endsWith('\n') ? '\n' : ''}${closer}\n` } }) }],
      })
    }
    if (node.kind === 'component' && known.size) {
      const def = known.get(node.name)
      const nameFrom = node.from + node.colons!
      const nameTo = nameFrom + node.name.length
      if (!def) {
        const guess = closest(node.name, known.keys())
        out.push({ from: nameFrom, to: nameTo, severity: 'warning', source: 'components', message: `Unknown component \`${node.name}\`.${guess ? ` Did you mean \`${guess}\`?` : ''}`, actions: guess ? [replaceWith(`Use ${guess}`, guess)] : undefined })
        continue
      }
      if (def.kind === 'inline') out.push({ from: nameFrom, to: nameTo, severity: 'warning', source: 'components', message: `\`${node.name}\` is an inline component (\`:${node.name}\`).` })
      const props = index.propsOf(node)
      const given = new Set(Object.keys(props).map(k => k.replace(/^::?/, '')))
      const missing = Object.entries(def.props ?? {}).filter(([n, p]) => p.required && !given.has(n)).map(([n]) => n)
      if (missing.length) out.push({ from: nameFrom, to: nameTo, severity: 'warning', source: 'components', message: `\`${node.name}\` needs ${missing.map(m => `\`${m}\``).join(', ')}.` })
      if (def.props && node.attrs) {
        for (const entry of parseAttributes(node.attrs.text, 0, node.attrs.from)) {
          if (entry.key === 'class' || entry.key === 'id' || entry.key === 'style' || entry.prefix === '@' || entry.name.startsWith('data-') || entry.name.startsWith('aria-')) continue
          const prop = def.props[entry.name]
          const keyTo = entry.from + entry.key.length
          if (!prop) {
            const guess = closest(entry.name, Object.keys(def.props))
            out.push({ from: entry.from, to: keyTo, severity: 'warning', source: 'components', message: `\`${node.name}\` has no prop \`${entry.name}\`.${guess ? ` Did you mean \`${guess}\`?` : ''}`, actions: guess ? [replaceWith(`Use ${guess}`, `${entry.prefix}${guess}`)] : undefined })
            continue
          }
          if (!entry.prefix && prop.enum && typeof entry.value === 'string' && !prop.enum.map(String).includes(entry.value)) {
            const at = entry.to - entry.value.length - 1
            out.push({ from: at, to: entry.to - 1, severity: 'warning', source: 'components', message: `\`${entry.name}\` must be one of ${prop.enum.map(v => `\`${v}\``).join(', ')}.` })
          }
        }
      }
    }
    if (node.kind === 'slot' && known.size && node.parent !== undefined) {
      const owner = nodes[node.parent]!
      const slots = known.get(owner.name)?.slots
      if (slots && !slots.some(s => s.name === node.name)) {
        const guess = closest(node.name, slots.map(s => s.name))
        out.push({ from: node.from, to: node.from + 1 + node.name.length, severity: 'warning', source: 'components', message: `\`${owner.name}\` has no slot \`#${node.name}\`.${guess ? ` Did you mean \`#${guess}\`?` : ''}`, actions: guess ? [replaceWith(`Use #${guess}`, `#${guess}`)] : undefined })
      }
    }
  }
  const closers = new Set(nodes.filter(n => n.kind === 'component' && n.closed).map(n => n.endLine))
  const regions = nodes.filter(n => n.kind === 'fence' || n.kind === 'math' || n.kind === 'frontmatter')
  for (let l = 1; l <= doc.lines; l++) {
    const line = doc.line(l)
    if (!/^\s*(?:(?:[-*+]|\d{1,9}[.)])\s+|>\s?)*:{2,}\s*$/.test(line.text) || closers.has(l)) continue
    if (regions.some(n => l > n.line && l <= n.endLine)) continue
    out.push({ from: line.from, to: line.to, severity: 'warning', source: 'components', message: 'This closer has no matching opener.', actions: [{ name: 'Remove', apply: view => view.dispatch({ changes: { from: line.from, to: Math.min(view.state.doc.length, line.to + 1) } }) }] })
  }
  return out
}

/** Binding paths (`{{ path }}`, `:prop="path"`, `::prop="path"`) that do not resolve. */
function bindings({ state, index, config }: LintContext): Diagnostic[] {
  const out: Diagnostic[] = []
  const doc = state.doc
  const regions = index.outline.filter(n => n.kind === 'fence' || n.kind === 'math' || n.kind === 'frontmatter')
  const scopesByLine = new Map<number, ScopeRoot[]>()
  const check = (path: string, from: number, model: boolean) => {
    const line = doc.lineAt(from).number
    let roots = scopesByLine.get(line)
    if (!roots) scopesByLine.set(line, roots = scopesAt(state, index, from, config))
    const [root, ...rest] = path.split('.')
    const scope = roots.find(r => r.name === root)
    if (!scope) return
    if (model && !scope.writable) {
      out.push({ from, to: from + path.length, severity: 'error', source: 'model', message: `\`${root}\` is not writable. Two-way bindings (\`::prop\`) must target ${roots.filter(r => r.writable).map(r => `\`${r.name}.*\``).join(', ') || '`data.*`'}.` })
      return
    }
    // walk until the path leaves what is known
    let shape = scope.shape
    for (let i = 0; i < rest.length; i++) {
      const next = shapeAt(shape, [rest[i]!])
      if (!next) {
        if (!shape.closed || (shape.type !== 'object' && shape.type !== 'array')) return
        const keys = Object.keys(shape.properties ?? {})
        const guess = closest(rest[i]!, keys)
        const segFrom = from + [root, ...rest.slice(0, i)].join('.').length + 1
        out.push({
          from: segFrom,
          to: segFrom + rest[i]!.length,
          severity: 'warning',
          source: 'binding',
          message: `\`${[root, ...rest.slice(0, i + 1)].join('.')}\` does not exist.${guess ? ` Did you mean \`${guess}\`?` : ''}`,
          actions: guess ? [replaceWith(`Use ${guess}`, guess)] : undefined,
        })
        return
      }
      shape = next
    }
  }
  for (let l = 1; l <= doc.lines; l++) {
    if (regions.some(n => l > n.line && l < (n.closed ? n.endLine : n.endLine + 1))) continue
    const line = doc.line(l)
    if (!line.text.includes('{')) continue
    for (const m of line.text.matchAll(/\{\{\s*([\w$.-]+)\s*(?:\|\|[^}]*)?\}\}/g)) {
      check(m[1]!, line.from + m.index + m[0].indexOf(m[1]!), false)
    }
    for (const m of line.text.matchAll(/(?<![\w-])(::?)[\w-]+=(["'])([\w$.-]+)\2/g)) {
      if (/^(?:true|false|null|-?\d)/.test(m[3]!)) continue
      check(m[3]!, line.from + m.index + m[0].indexOf(m[2]!) + 1, m[1] === '::')
    }
  }
  return out
}

/** All diagnostics for a state: core checks plus every plugin's `lint`. */
export function diagnose(state: EditorState, config: ResolvedConfig = configOf(state)): Diagnostic[] {
  const ctx: LintContext = { state, index: docIndex(state), config }
  const out = [...structure(ctx), ...bindings(ctx)]
  for (const plugin of config.plugins) for (const source of plugin.lint ?? []) out.push(...source(ctx))
  return out.sort((a, b) => a.from - b.from)
}
