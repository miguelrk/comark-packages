/**
 * Hover docs: components and props from the manifest, binding values,
 * footnote definitions and heading targets, plus every plugin's `hover`.
 */
import type { EditorState } from '@codemirror/state'
import type { HoverResult, ResolvedConfig } from './types.ts'
import { scopesAt, shapeAt } from './bindings.ts'
import { componentDocs, propDetail } from './complete/items.ts'
import { configOf } from './config.ts'
import { parseAttributes } from './document/attributes.ts'
import { docIndex } from './document/index.ts'

export function hoverAt(state: EditorState, pos: number, config: ResolvedConfig = configOf(state)): HoverResult | null {
  const index = docIndex(state)
  const line = state.doc.lineAt(pos)
  const col = pos - line.from
  const within = (from: number, to: number) => col >= from && col <= to

  for (const m of line.text.matchAll(/(?<![\w:])(:{1,})([A-Za-z$][\w$.-]*)/g)) {
    const from = m.index + m[1]!.length
    const def = config.components.get(m[2]!)
    if (def && within(m.index, from + m[2]!.length)) return { from: line.from + m.index, to: line.from + from + m[2]!.length, info: componentDocs(def) }
  }

  // props inside a component's attribute block
  const opener = index.outline.find(n => n.kind === 'component' && n.line === line.number)
  if (opener?.attrs) {
    const def = config.components.get(opener.name)
    for (const entry of parseAttributes(opener.attrs.text, 0, opener.attrs.from)) {
      const keyTo = entry.from + entry.key.length
      if (pos < entry.from || pos > keyTo) continue
      const prop = def?.props?.[entry.name]
      if (prop) return { from: entry.from, to: keyTo, info: { title: entry.name, description: prop.description, rows: [['type', propDetail(prop)], ...(prop.default !== undefined ? [['default', JSON.stringify(prop.default)] as const] : [])] } }
    }
  }

  // binding paths
  const paths = [
    ...[...line.text.matchAll(/\{\{\s*([\w$.-]+)/g)].map(m => ({ path: m[1]!, from: m.index + m[0].length - m[1]!.length })),
    ...[...line.text.matchAll(/(?<![\w-])::?[\w-]+=(["'])([\w$.-]+)\1/g)].map(m => ({ path: m[2]!, from: m.index + m[0].indexOf(m[1]!) + 1 })),
  ]
  for (const { path, from } of paths) {
    if (!within(from, from + path.length)) continue
    const [root, ...rest] = path.split('.')
    const scope = scopesAt(state, index, pos, config).find(r => r.name === root)
    const shape = shapeAt(scope?.shape, rest)
    if (!scope) return null
    return { from: line.from + from, to: line.from + from + path.length, info: { title: path, description: shape?.description ?? (shape ? undefined : 'Not found in the known data.'), value: shape?.value, rows: shape?.type ? [['type', shape.type]] : undefined } }
  }

  for (const ref of index.footnoteRefs) {
    if (pos >= ref.from && pos <= ref.to) {
      const def = index.footnotes.get(ref.id)
      return { from: ref.from, to: ref.to, info: def ? { title: `[^${ref.id}]`, description: def.text } : `Footnote \`[^${ref.id}]\` has no definition.` }
    }
  }

  for (const m of line.text.matchAll(/\]\(#([\w-]+)\)/g)) {
    const from = m.index + 3
    if (!within(from - 1, from + m[1]!.length)) continue
    const heading = index.headings.find(h => h.id === m[1])
    return { from: line.from + from - 1, to: line.from + from + m[1]!.length, info: heading ? { title: `${'#'.repeat(heading.level)} ${heading.text}`, description: `Line ${heading.line}` } : `No heading with id \`${m[1]}\`.` }
  }

  for (const plugin of config.plugins) {
    for (const source of plugin.hover ?? []) {
      const res = source({ state, index, config, pos })
      if (res) return res
    }
  }
  return null
}
