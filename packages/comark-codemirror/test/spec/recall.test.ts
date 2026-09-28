/**
 * The "autocomplete everything" gate. For every completable token in
 * comark's SPEC fixtures (component names, props, prop values, slots,
 * binding path segments, emoji, alert types, fence languages, footnote ids,
 * heading anchors, task boxes, YAML prop keys), put the cursor where the
 * token starts (after its trigger) and ask `complete()`. The real token must
 * be among the items.
 *
 * Each fixture runs with a manifest derived from the fixture itself (the
 * components, props, values and slots it uses) and `data` built from the
 * `data.*` paths it binds: that is what a host's manifest and data provide.
 */
import type { ComponentDef, PropDef } from '../../src/index.ts'
import { EditorState } from '@codemirror/state'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { complete } from '../../src/complete/engine.ts'
import { docIndex } from '../../src/document/index.ts'
import { parseAttributes } from '../../src/document/attributes.ts'
import { EMOJI } from '../../src/plugins/emoji-data.ts'
import { comark } from '../../src/setup.ts'
import { presetBuiltins } from '../../src/presets/builtins.ts'
import shiki from '../../src/plugins/shiki.ts'
import { fixtures } from './fixtures.ts'

interface Probe {
  kind: string
  /** Cursor offset (after the trigger). */
  pos: number
  /** The label the menu must contain. */
  expect: string
}

/** Derive a manifest and data from what the fixture uses. */
function hostFor(input: string) {
  const state = EditorState.create({ doc: input })
  const index = docIndex(state)
  const defs = new Map<string, { kind: Set<'block' | 'inline'>, props: Map<string, Set<string>>, slots: Set<string> }>()
  const def = (name: string) => {
    let d = defs.get(name)
    if (!d) defs.set(name, d = { kind: new Set(), props: new Map(), slots: new Set() })
    return d
  }
  const addProp = (name: string, key: string, value: unknown) => {
    const d = def(name)
    const prop = key.replace(/^::?|^@/, '')
    if (!d.props.has(prop)) d.props.set(prop, new Set())
    if (typeof value === 'string' && !key.startsWith(':')) d.props.get(prop)!.add(value)
  }
  for (const node of index.outline) {
    if (node.kind === 'component') {
      def(node.name).kind.add('block')
      for (const [k, v] of Object.entries(index.propsOf(node))) addProp(node.name, k, v)
    }
    if (node.kind === 'slot' && node.parent !== undefined) def(index.outline[node.parent]!.name).slots.add(node.name)
  }
  for (const m of input.matchAll(/(?<![\w:]):([A-Za-z][\w-]*)(\[[^\]\n]*\])?(\{[^}\n]*\})?/g)) {
    if (/^\s*$/.test(input.slice(input.lastIndexOf('\n', m.index) + 1, m.index)) && input[m.index + m[0].length] === ':') continue
    def(m[1]!).kind.add('inline')
    if (m[3]) for (const e of parseAttributes(m[3])) addProp(m[1]!, e.key, e.value)
  }
  const components: ComponentDef[] = [...defs].map(([name, d]) => ({
    name,
    kind: d.kind.size === 2 ? 'both' : d.kind.has('inline') ? 'inline' : 'block',
    props: Object.fromEntries([...d.props].map(([p, values]): [string, PropDef] => [p, values.size && ![...values].includes('') ? { enum: [...values], model: true } : { type: 'any', model: true }])),
    slots: [...d.slots].map(s => ({ name: s })),
  }))
  const data: Record<string, unknown> = {}
  for (const m of input.matchAll(/\bdata\.([\w.]+)/g)) {
    let cur = data
    const parts = m[1]!.split('.')
    parts.forEach((p, i) => {
      if (i === parts.length - 1) cur[p] ??= 'x'
      else cur = (cur[p] = typeof cur[p] === 'object' && cur[p] ? cur[p] : {}) as Record<string, unknown>
    })
  }
  return { components, data }
}

/** Every completable token of a document. */
function probes(input: string): Probe[] {
  const state = EditorState.create({ doc: input })
  const index = docIndex(state)
  const out: Probe[] = []
  const skip = (line: number) => index.outline.some(n => (n.kind === 'fence' || n.kind === 'math' || n.kind === 'frontmatter') && line > n.line && line < (n.closed ? n.endLine : n.endLine + 1))
  const inCode = (text: string, col: number) => (text.slice(0, col).match(/`/g) ?? []).length % 2 === 1
  for (let l = 1; l <= state.doc.lines; l++) {
    const line = state.doc.line(l)
    const text = line.text
    const node = index.outline.find(n => n.line === l && n.kind !== 'heading')
    if (node?.kind === 'fence') {
      const m = /^(\s*(?:[-*+>]\s*)*(?:`{3,}|~{3,}))([\w+#.-]+)/.exec(text)
      if (m) out.push({ kind: 'fence-lang', pos: line.from + m[1]!.length, expect: m[2]! })
      continue
    }
    if (index.regionAt(l)?.kind === 'props') {
      // top-level YAML props keys
      const owner = index.regionAt(l)!.node
      const indent = /^\s*/.exec(state.doc.line(owner.line).text)![0].length
      const m = /^(\s*)([\w-]+):/.exec(text)
      if (m && m[1]!.length === indent) out.push({ kind: 'props-key', pos: line.from + m[1]!.length, expect: m[2]! })
      continue
    }
    if (skip(l)) continue
    if (node?.kind === 'component') {
      const at = text.indexOf(':')
      const colons = node.colons!
      out.push({ kind: 'component-name', pos: line.from + at + colons, expect: `${':'.repeat(colons)}${node.name}` })
      if (node.attrs) {
        for (const e of parseAttributes(node.attrs.text, 0, node.attrs.from)) {
          if (e.key === 'class' || e.key === 'id' || e.prefix === '@') continue
          out.push({ kind: 'attr-key', pos: e.from + e.prefix.length, expect: `${e.prefix}${e.name}` })
          if (typeof e.value === 'string' && e.value && !e.prefix) out.push({ kind: 'attr-value', pos: e.to - e.value.length - (/["']$/.test(node.attrs.text.slice(0, e.to - node.attrs.from)) ? 1 : 0), expect: e.value })
        }
      }
    }
    if (node?.kind === 'slot') out.push({ kind: 'slot', pos: node.from + 1, expect: `#${node.name}` })
    for (const m of text.matchAll(/(?<![\w:\\])(:)([A-Za-z][\w-]*)(?=[[{\s.,!?)]|$)/g)) {
      if (inCode(text, m.index) || /^\s*:{2,}/.test(text.slice(0, m.index + 1)) || text[m.index + m[0].length] === ':') continue
      out.push({ kind: 'component-name', pos: line.from + m.index + 1, expect: `:${m[2]}` })
    }
    for (const m of text.matchAll(/(?<![\w:])(:[\w+-]{2})([\w+-]*):/g)) {
      const name = m[1]!.slice(1) + m[2]!
      if (EMOJI[name] && !inCode(text, m.index)) out.push({ kind: 'emoji', pos: line.from + m.index + 3, expect: `:${name}:` })
    }
    const alert = /^(\s*>\s*\[)!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(text)
    if (alert) out.push({ kind: 'alert', pos: line.from + alert[1]!.length, expect: `[!${alert[2]!.toUpperCase()}]` })
    const task = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]/.exec(text)
    if (task) out.push({ kind: 'task', pos: line.from + task[1]!.length, expect: task[2] === ' ' ? '[ ]' : '[x]' })
    for (const m of text.matchAll(/\[\^([^\]\s]+)\](?!:)/g)) out.push({ kind: 'footnote', pos: line.from + m.index + 2, expect: m[1]! })
    for (const m of text.matchAll(/\]\(#([\w-]+)\)/g)) if (index.headings.some(h => h.id === m[1])) out.push({ kind: 'anchor', pos: line.from + m.index + 3, expect: `#${m[1]}` })
    // binding segments: {{ a.b.c }} and :prop="a.b.c"
    const paths = [
      ...[...text.matchAll(/\{\{\s*([\w$.-]+)/g)].map(m => ({ path: m[1]!, at: m.index + m[0].length - m[1]!.length })),
      ...[...text.matchAll(/(?<![\w-])::?[\w-]+=(["'])([\w$.-]+)\1/g)].map(m => ({ path: m[2]!, at: m.index + m[0].indexOf(m[1]!) + 1 })),
    ]
    for (const { path, at } of paths) {
      if (!/^(?:frontmatter|props|data|meta)\b/.test(path) || /^(?:true|false|-?\d)/.test(path)) continue
      let offset = at
      for (const seg of path.split('.')) {
        out.push({ kind: 'binding', pos: line.from + offset, expect: seg })
        offset += seg.length + 1
      }
    }
  }
  return out
}

describe('completion recall on comark SPEC fixtures', () => {
  const results: { name: string, probe: Probe, labels: string[] }[] = []

  it('finds every completable token', async () => {
    const shikiPlugin = shiki()
    for (const { name, input } of fixtures) {
      const { components, data } = hostFor(input)
      const base = EditorState.create({ doc: input, extensions: comark({ components, data, plugins: [...presetBuiltins(), shikiPlugin] }) })
      for (const probe of probes(input)) {
        const res = await complete(base, probe.pos, { explicit: true })
        results.push({ name, probe, labels: res?.items.map(i => i.label) ?? [] })
      }
    }
    const misses = results.filter(r => !r.labels.includes(r.probe.expect))
      .map(r => `${r.name} ${r.probe.kind} "${r.probe.expect}" → [${r.labels.slice(0, 6).join(', ')}${r.labels.length > 6 ? ', …' : ''}]`)
    const kinds = new Map<string, number>()
    for (const r of results) kinds.set(r.probe.kind, (kinds.get(r.probe.kind) ?? 0) + 1)
    console.info(`recall: ${results.length - misses.length}/${results.length} tokens`, Object.fromEntries(kinds))
    expect(results.length).toBeGreaterThan(300)
    expect(misses).toEqual([])
  })

  it('never throws at any position', async () => {
    const doc = fixtures.map(f => f.input).join('\n\n')
    const state = EditorState.create({ doc, extensions: comark({ plugins: presetBuiltins() }) })
    await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: doc.length }), fc.boolean(), async (pos, explicit) => {
      await complete(state, pos, { explicit })
    }), { numRuns: 1500 })
  })
})
