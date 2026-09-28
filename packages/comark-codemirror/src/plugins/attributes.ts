/**
 * Attributes (default): `{#id .class key="value"}` after inline elements
 * (`**bold**{.x}`, `[text]{.x}`, links, images, code) and at the end of
 * headings. Completes common attributes, classes and ids used in the
 * document, and flags unclosed attribute blocks.
 */
import type { Diagnostic } from '@codemirror/lint'
import type { CompletionProvider, Item, ProviderContext } from '../types.ts'
import { genericAttrItems } from '../complete/items.ts'
import { definePlugin } from '../plugins.ts'

const BY_OWNER: Record<string, readonly (readonly [string, string])[]> = {
  link: [['target', '_blank'], ['rel', 'noopener']],
  image: [['width', ''], ['height', ''], ['loading', 'lazy']],
  code: [['lang', '']],
}

const providers: CompletionProvider<any>[] = [
  {
    kinds: ['attr-key'],
    provide(ctx: ProviderContext<'attr-key'>) {
      const { owner, prefix, separated, present } = ctx.context
      if (owner.type === 'component' || owner.type === 'slot' || prefix) return null
      const sep = separated ? '' : ' '
      const items: Item[] = (BY_OWNER[owner.type] ?? [])
        .filter(([name]) => !present.includes(name))
        .map(([name, value]) => ({ label: name, insert: value ? `${sep}${name}="${value}"$0` : `${sep}${name}="$0"`, detail: owner.type, type: 'prop', chain: !value }))
      return [...items, ...genericAttrItems(ctx.context).map(i => ({ ...i, section: undefined }))]
    },
  },
  {
    kinds: ['attr-class'],
    provide: (ctx: ProviderContext<'attr-class'>) => [...ctx.index.usages.classes].filter(c => !ctx.context.present.includes(c)).map(c => ({ label: c, type: 'class', detail: 'used here' })),
  },
  {
    kinds: ['attr-id'],
    provide: (ctx: ProviderContext<'attr-id'>) => ctx.index.headings.map(h => ({ label: h.id, type: 'id', detail: `${'#'.repeat(h.level)} ${h.text}` })),
  },
]

export default definePlugin(() => ({
  name: 'attributes',
  completions: providers,
  lint: [({ state, index }) => {
    const out: Diagnostic[] = []
    const regions = index.outline.filter(n => n.kind === 'fence' || n.kind === 'math' || n.kind === 'frontmatter')
    for (let l = 1; l <= state.doc.lines; l++) {
      if (regions.some(n => l >= n.line && l <= n.endLine)) continue
      const line = state.doc.line(l)
      const m = /(?:[*_~`)\]]|^\s*:{2,}[A-Za-z$][\w$.-]*|(?<![\w:]):[A-Za-z][\w-]*)\{(?!\{)([^}]*)$/.exec(line.text)
      if (m && !/["']/.test(m[1]!.slice(-1))) {
        const at = line.from + m.index + m[0].indexOf('{')
        out.push({ from: at, to: line.to, severity: 'warning', source: 'attributes', message: 'Attribute block is not closed with `}`.', actions: [{ name: 'Add }', apply: view => view.dispatch({ changes: { from: line.to, insert: '}' } }) }] })
      }
    }
    return out
  }],
  llms: 'Attributes `{#id .class key="value" flag}` go right after an inline element (`**bold**{.x}`, `[link](url){target="_blank"}`, `[span]{.x}`) or at the end of a heading (`## Title {#custom-id}`).',
}))
