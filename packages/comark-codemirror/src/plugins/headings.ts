/**
 * Headings: `[text](#…)` completes the ids comark generates (hierarchical,
 * deduplicated, `{#id}` overrides), lint flags duplicate ids and broken
 * anchors, and `meta.title` / `meta.description` are available to bindings.
 */
import type { Diagnostic } from '@codemirror/lint'
import { shapeOf } from '../bindings.ts'
import { definePlugin } from '../plugins.ts'

export default definePlugin(() => ({
  name: 'headings',
  completions: [{
    kinds: ['link-url'],
    provide: ({ context, index }) => (context.kind === 'link-url' && (context.anchor || context.typed === '')
      ? index.headings.map(h => ({ label: `#${h.id}`, insert: `#${h.id}`, detail: `${'#'.repeat(h.level)} ${h.text}`, type: 'heading', section: 'Headings' }))
      : null),
  }],
  scopes: [({ state, index }) => {
    const h1 = index.headings.find(h => h.level === 1)
    let description: string | undefined
    if (h1) {
      for (let l = h1.line + 1; l <= state.doc.lines; l++) {
        const text = state.doc.line(l).text.trim()
        if (!text) continue
        if (/^[#:>|`-]/.test(text)) break
        description = text
        break
      }
    }
    return { name: 'meta', shape: shapeOf({ title: h1?.text, description }) }
  }],
  lint: [({ state, index }) => {
    const out: Diagnostic[] = []
    const seen = new Set<string>()
    for (const h of index.headings) {
      if (seen.has(h.id)) out.push({ from: h.from, to: state.doc.line(h.line).to, severity: 'warning', source: 'headings', message: `Duplicate heading id \`${h.id}\`.` })
      seen.add(h.id)
    }
    const ids = new Set(index.headings.map(h => h.id))
    const regions = index.outline.filter(n => n.kind === 'fence' || n.kind === 'frontmatter')
    for (let l = 1; l <= state.doc.lines; l++) {
      if (regions.some(n => l >= n.line && l <= n.endLine)) continue
      const line = state.doc.line(l)
      for (const m of line.text.matchAll(/\]\(#([\w-]+)\)/g)) {
        if (!ids.has(m[1]!)) out.push({ from: line.from + m.index + 3, to: line.from + m.index + 3 + m[1]!.length, severity: 'warning', source: 'headings', message: `No heading with id \`${m[1]}\`.` })
      }
    }
    return out
  }],
  llms: 'Headings get ids automatically (`## Install` → `#install`; h3+ ids are prefixed by their parent heading). Link with `[text](#id)`; set an id with `## Title {#custom}`.',
}))
