/**
 * Footnotes: `[^id]` references and `[^id]: text` definitions. Completes
 * defined ids (or a new one, adding its definition), flags missing and
 * unused footnotes, and shows definitions on hover.
 */
import type { Diagnostic } from '@codemirror/lint'
import type { EditorState } from '@codemirror/state'
import type { Edit, Item } from '../types.ts'
import { docIndex } from '../document/index.ts'
import { definePlugin } from '../plugins.ts'

export function insertFootnote(state: EditorState, content = '', id?: string): Edit {
  const index = docIndex(state)
  const next = id ?? String(Math.max(0, ...[...index.footnotes.keys()].map(Number).filter(n => !Number.isNaN(n))) + 1)
  const pos = state.selection.main.head
  const end = state.doc.length
  const sep = state.doc.toString().endsWith('\n') ? '\n' : '\n\n'
  return { ok: true, changes: [{ from: pos, insert: `[^${next}]` }, { from: end, insert: `${sep}[^${next}]: ${content}` }], selection: { anchor: pos + next.length + 3 } }
}

export default definePlugin(() => ({
  name: 'footnotes',
  completions: [{
    kinds: ['footnote'],
    provide({ index, state }) {
      const items: Item[] = [...index.footnotes.values()].map(f => ({ label: f.id, insert: `${f.id}]`, detail: f.text.slice(0, 40), info: { title: `[^${f.id}]`, description: f.text }, type: 'footnote' }))
      const next = String(Math.max(0, ...[...index.footnotes.keys()].map(Number).filter(n => !Number.isNaN(n))) + 1)
      const end = state.doc.length
      items.push({
        label: next,
        detail: 'new footnote',
        type: 'footnote',
        section: 'New',
        apply(view, _c, from, to) {
          const sep = view.state.doc.toString().endsWith('\n') ? '\n' : '\n\n'
          const def = `${sep}[^${next}]: `
          view.dispatch({ changes: [{ from, to, insert: `${next}]` }, { from: end, insert: def }], selection: { anchor: end + (next.length + 1 - (to - from)) + def.length } })
        },
      })
      return items
    },
  }],
  commands: [{
    name: 'insertFootnote',
    description: 'Insert a footnote reference at the cursor and its definition at the end of the document.',
    params: { type: 'object', properties: { content: { type: 'string' }, id: { type: 'string' } } },
    run: (state, p) => insertFootnote(state, typeof p.content === 'string' ? p.content : '', typeof p.id === 'string' ? p.id : undefined),
  }],
  lint: [({ state, index }) => {
    const out: Diagnostic[] = []
    for (const ref of index.footnoteRefs) {
      if (!index.footnotes.has(ref.id)) {
        out.push({ from: ref.from, to: ref.to, severity: 'warning', source: 'footnotes', message: `Footnote \`[^${ref.id}]\` has no definition.`, actions: [{ name: 'Add definition', apply: view => view.dispatch({ changes: { from: view.state.doc.length, insert: `\n\n[^${ref.id}]: ` } }) }] })
      }
    }
    const used = new Set(index.footnoteRefs.map(r => r.id))
    for (const def of index.footnotes.values()) {
      if (!used.has(def.id)) out.push({ from: def.from, to: Math.min(def.to, state.doc.length), severity: 'info', source: 'footnotes', message: `Footnote \`[^${def.id}]\` is never referenced.` })
    }
    return out
  }],
  snippets: [{ label: 'Footnote', insert: '[^$1]: $0', detail: '[^1]: text', section: 'Document', type: 'footnote' }],
  llms: 'Footnotes: reference with `[^1]`, define on its own line with `[^1]: text`.',
}))
