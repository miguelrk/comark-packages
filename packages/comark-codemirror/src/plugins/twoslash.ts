/**
 * Twoslash: ```` ```ts twoslash ```` fences. Completes the `twoslash` meta
 * and twoslash annotations (`// ^?`, `// @errors:`, `// ---cut---`) inside.
 */
import type { Item } from '../types.ts'
import { definePlugin } from '../plugins.ts'

const TS = /^(?:ts|tsx|typescript|js|jsx|javascript|vue)$/

const ANNOTATIONS = [
  ['// ^?', 'query the type above'],
  ['// ^|', 'completions at the position above'],
  ['// @errors: ', 'expected error codes'],
  ['// @noErrors', 'ignore errors'],
  ['// ---cut---', 'hide the code above'],
  ['// @filename: ', 'start a virtual file'],
  ['// @highlight', 'highlight the next line'],
] as const

export default definePlugin(() => ({
  name: 'twoslash',
  completions: [
    {
      kinds: ['fence-meta'],
      provide: ({ context, state }) => (context.kind === 'fence-meta' && TS.test(context.lang) && !/\btwoslash\b/.test(state.doc.lineAt(context.pos).text)
        ? [{ label: 'twoslash', detail: 'show types', type: 'keyword' } satisfies Item]
        : null),
    },
    {
      kinds: ['fence-body'],
      provide({ context, state, index }) {
        if (context.kind !== 'fence-body') return null
        const fence = index.regionAt(context.line)?.node
        if (!fence || !TS.test(fence.name) || !/\btwoslash\b/.test(fence.info ?? '')) return null
        const before = state.sliceDoc(state.doc.lineAt(context.pos).from, context.pos)
        const m = /(?:^|\s)(\/\/\s*[\w^@-]*)$/.exec(before)
        if (!m) return null
        return ANNOTATIONS.map(([label, detail]): Item => ({ label, detail, type: 'keyword', apply: (view, _c, _from, to) => view.dispatch({ changes: { from: context.pos - m[1]!.length, to, insert: label }, selection: { anchor: context.pos - m[1]!.length + label.length } }) }))
      },
    },
  ],
  snippets: [{ label: 'TypeScript (twoslash)', insert: '```ts twoslash\n$0\n```', detail: '```ts twoslash', section: 'Code', type: 'fence' }],
  llms: 'Twoslash: ```` ```ts twoslash ```` fences show TypeScript types; `// ^?` queries the type of the symbol above.',
}))
