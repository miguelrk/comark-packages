/**
 * Binding: `{{ path || fallback }}` interpolation and the `::if` / `::for`
 * control components. Paths complete segment by segment from the live
 * frontmatter, the enclosing component's props, `data`, `meta` and loop
 * variables (`::for{:each="data.posts" item="post"}` → `post.*`).
 */
import type { ComponentDef, ProviderContext } from '../types.ts'
import { scopesAt, shapeAt } from '../bindings.ts'
import { bindingItems } from '../complete/items.ts'
import { definePlugin } from '../plugins.ts'

const WRAPPERS = ['div', 'span', 'p', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav'] as const

export const bindingComponents: ComponentDef[] = [
  {
    name: 'if',
    kind: 'block',
    description: 'Render content when a condition holds; `#else` for the alternative.',
    group: 'Logic',
    props: {
      value: { type: 'any', description: 'Value (or `:value` data path) to test' },
      eq: { type: 'any', description: 'Equal to' },
      neq: { type: 'any', description: 'Not equal to' },
      gt: { type: 'number' },
      gte: { type: 'number' },
      lt: { type: 'number' },
      lte: { type: 'number' },
      as: { enum: WRAPPERS, description: 'Wrapper element' },
    },
    slots: [{ name: 'default' }, { name: 'else', description: 'Rendered when the condition fails' }],
    example: '::if{:value="frontmatter.published"}\nPublished\n#else\nDraft\n::',
  },
  {
    name: 'for',
    kind: 'block',
    description: 'Repeat content for each item of a list; `#empty` when it has none.',
    group: 'Logic',
    props: {
      each: { type: 'array', description: 'List (`:each` data path)' },
      item: { type: 'string', default: 'item', description: 'Name of the loop variable' },
      index: { type: 'string', description: 'Name of the index variable' },
      key: { type: 'string' },
    },
    slots: [{ name: 'default' }, { name: 'empty', description: 'Rendered when the list is empty' }],
    scope: [
      { name: 'item', nameProp: 'item', source: 'each', element: true, description: 'Current item' },
      { name: 'index', nameProp: 'index', description: 'Current index' },
    ],
    example: '::for{:each="data.posts" item="post"}\n- {{ post.title }}\n::',
  },
]

export default definePlugin(() => ({
  name: 'binding',
  components: bindingComponents,
  completions: [
    {
      kinds: ['binding-path'],
      provide: (ctx: ProviderContext<'binding-path'>) => (ctx.context.mode === 'interpolation' ? bindingItems(ctx) : null),
    },
    {
      kinds: ['binding-default'],
      provide(ctx: ProviderContext<'binding-default'>) {
        const [root, ...rest] = ctx.context.path.split('.')
        const shape = shapeAt(scopesAt(ctx.state, ctx.index, ctx.context.pos, ctx.config).find(r => r.name === root)?.shape, rest)
        const inner = ctx.state.sliceDoc(ctx.state.doc.lineAt(ctx.context.pos).from, ctx.context.pos).split('{{').at(-1) ?? ''
        if (!inner.includes('||')) return [{ label: '||', insert: '|| $0', detail: 'fallback value', type: 'keyword', chain: true }]
        return typeof shape?.value === 'string' ? [{ label: shape.value, detail: 'current value', type: 'value' }] : []
      },
    },
  ],
  snippets: [{ label: 'binding', insert: '{{ $0 }}', context: 'inline', detail: '{{ path }}', type: 'binding-root', chain: true, info: 'Insert a value: `{{ frontmatter.title }}`, with a fallback `{{ data.name || guest }}`.' }],
  llms: 'Bindings: `{{ path }}` or `{{ path || fallback }}` inserts a value. Roots: `frontmatter.*` (this document), `props.*` (the enclosing component), `data.*`, `meta.*`. `::if{:value="path"}` … `#else` … `::` and `::for{:each="data.items" item="item"}` … `::` control rendering.',
}))
