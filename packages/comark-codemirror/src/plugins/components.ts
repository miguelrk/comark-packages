/**
 * Components (default): block and inline components from the manifest.
 * Completes names, props (plain, `:bound`, `::model`), prop values, slots,
 * YAML props blocks and binding paths in bound props, as one chain:
 * `::ca` → `::card{|}` → `variant="|"` → `primary` → next prop.
 */
import type { CompletionProvider, ComponentDef, Item, ProviderContext } from '../types.ts'
import { bindingItems, blockComponentItem, continuation, genericAttrItems, inlineComponentItem, propDetail, propItems, valueItems } from '../complete/items.ts'
import { definePlugin } from '../plugins.ts'

type Ctx = Pick<ProviderContext, 'config' | 'index'> & { context: { stack: ProviderContext['context']['stack'] } }

const allowedIn = (ctx: Ctx, def: ComponentDef) => {
  const parent = ctx.context.stack.at(-1)
  const rule = parent ? ctx.config.components.get(parent.name)?.children : undefined
  return !rule || rule.includes(def.name)
}

/** Names written elsewhere in the document that the manifest does not know (not the one being typed). */
const usedNames = (ctx: Ctx, typed = '') => [...ctx.index.usages.components].filter(n => !ctx.config.components.has(n) && n !== typed.replace(/^:+/, ''))

const unknown = (name: string): ComponentDef => ({ name, kind: 'both' })

const providers: CompletionProvider<any>[] = [
  {
    kinds: ['block'],
    provide(ctx: ProviderContext<'block'>) {
      if (ctx.context.typed.startsWith('-')) return []
      const colons = Math.max(2, (ctx.context.stack.at(-1)?.colons ?? 1) + 1)
      const indent = continuation(ctx.state, ctx.context.from - (ctx.context.slash ? 1 : 0))
      const items: Item[] = [...ctx.config.components.values()]
        .filter(def => def.kind !== 'inline' && allowedIn(ctx, def))
        .map(def => ({ ...blockComponentItem(def, colons, indent), label: def.name }))
      const parent = ctx.context.stack.at(-1)
      const slots = parent ? ctx.config.components.get(parent.name)?.slots ?? [] : []
      for (const slot of slots) {
        if (slot.name === 'default') continue
        items.push({ label: `#${slot.name}`, insert: `#${slot.name}\n${indent}$0`, detail: slot.description ?? `slot of ${parent!.name}`, type: 'slot', section: 'Slots' })
      }
      return items
    },
  },
  {
    kinds: ['component-name'],
    provide(ctx: ProviderContext<'component-name'>) {
      const { context } = ctx
      if (context.inline) {
        const items = [...ctx.config.components.values()].filter(d => d.kind !== 'block').map(inlineComponentItem)
        for (const name of usedNames(ctx, context.typed)) items.push({ ...inlineComponentItem(unknown(name)), section: 'Used in this document', detail: 'used here' })
        return items
      }
      const indent = continuation(ctx.state, context.from)
      const items: Item[] = []
      if (context.closer) {
        items.push({ label: ':'.repeat(context.colons), insert: ':'.repeat(context.colons), detail: `close ::${context.closer.name}`, type: 'close', section: 'Close', boost: 50 })
      }
      for (const def of ctx.config.components.values()) {
        if (def.kind === 'inline' || !allowedIn(ctx, def)) continue
        items.push(blockComponentItem(def, context.colons, indent))
      }
      for (const name of usedNames(ctx, context.typed)) items.push({ ...blockComponentItem(unknown(name), context.colons, indent), section: 'Used in this document', detail: 'used here', info: undefined })
      return items
    },
  },
  {
    kinds: ['attr-key'],
    provide(ctx: ProviderContext<'attr-key'>) {
      const { owner } = ctx.context
      if (owner.type === 'component') {
        const def = ctx.config.components.get(owner.name)
        const used = new Set<string>()
        if (!def) {
          for (const key of ctx.index.usages.values.keys()) if (key.startsWith(`${owner.name}.`)) used.add(key.slice(owner.name.length + 1))
        }
        return [...propItems(ctx.context, def, used), ...genericAttrItems(ctx.context)]
      }
      if (owner.type === 'slot') {
        const items: Item[] = [{ label: 'unwrap', insert: `${ctx.context.separated ? '' : ' '}unwrap="$0"`, detail: 'unwrap a wrapping element', type: 'prop', chain: true }]
        return ctx.context.prefix ? [] : [...items, ...genericAttrItems(ctx.context)]
      }
      return null
    },
  },
  {
    kinds: ['attr-value'],
    provide(ctx: ProviderContext<'attr-value'>) {
      const { owner, name } = ctx.context
      if (owner.type === 'slot' && name === 'unwrap') return valueItems({ enum: ['p', 'div', 'span'] }, [], name)
      if (owner.type !== 'component') return null
      const prop = ctx.config.components.get(owner.name)?.props?.[name]
      return valueItems(prop, ctx.index.usages.values.get(`${owner.name}.${name}`) ?? [], name)
    },
  },
  {
    kinds: ['binding-path'],
    provide: (ctx: ProviderContext<'binding-path'>) => (ctx.context.mode === 'interpolation' ? null : bindingItems(ctx)),
  },
  {
    kinds: ['slot'],
    provide(ctx: ProviderContext<'slot'>) {
      const def = ctx.config.components.get(ctx.context.component.name)
      const indent = continuation(ctx.state, ctx.context.from)
      // named slots first; `#default` names the default slot explicitly
      return [...(def?.slots ?? [])].sort((a, b) => Number(a.name === 'default') - Number(b.name === 'default')).map(slot => ({
        label: `#${slot.name}`,
        insert: `#${slot.name}\n${indent}$0`,
        detail: slot.description ?? (slot.name === 'default' ? 'default slot' : 'slot'),
        type: 'slot',
      }))
    },
  },
  {
    kinds: ['props-key'],
    provide(ctx: ProviderContext<'props-key'>) {
      const { context } = ctx
      if (context.path.length) return null
      const def = ctx.config.components.get(context.component.name)
      const present = new Set(context.present)
      return Object.entries(def?.props ?? {}).filter(([n]) => !present.has(n)).map(([name, p]) => ({
        label: name,
        insert: p.type === 'object' ? `${name}:\n  $0` : p.type === 'array' ? `${name}:\n  - $0` : `${name}: $0`,
        detail: `${propDetail(p)}${p.required ? ' · required' : ''}`,
        info: { title: name, description: p.description, rows: [['type', propDetail(p)]] },
        type: 'prop',
        boost: p.required ? 10 : 0,
        chain: !!p.enum || p.type === 'boolean',
      }))
    },
  },
  {
    kinds: ['props-value'],
    provide(ctx: ProviderContext<'props-value'>) {
      const { context } = ctx
      if (context.path.length) return null
      const prop = ctx.config.components.get(context.component.name)?.props?.[context.key]
      return valueItems(prop, [], context.key).map(i => ({ ...i, exit: false, chain: false }))
    },
  },
]

export default definePlugin<{ components?: readonly ComponentDef[] }>((options = {}) => ({
  name: 'components',
  components: options.components,
  completions: providers,
  llms: [
    'Block components: `::name{prop="value"}` on its own line, content, then `::`. Nest with more colons (`:::child` … `:::`).',
    'Inline components: `:name`, `:name[text]`, `:name{prop="value"}`.',
    'Named slots inside a block component: a line `#slot-name`, then its content.',
    'Props: `key="value"`, bare `flag` (true), `:key="path"` binds to data (`frontmatter.*`, `props.*`, `data.*`, `meta.*`), `::key="data.x"` binds two-way.',
    'Many props can go in a YAML block right under the opener, between `---` lines.',
  ].join('\n'),
}))
