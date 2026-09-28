/**
 * The completion engine: one CodeMirror completion source for every Comark
 * context. It resolves the cursor context, asks the providers registered for
 * that context kind, and turns their items into CodeMirror completions with
 * sections, chaining and a docs panel. `complete()` runs the same pipeline
 * without a view (tests, agents).
 */
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import type { EditorState } from '@codemirror/state'
import type { ContextKind, CursorContext } from '../context/types.ts'
import type { CompletionProvider, Item, ProviderContext, ResolvedConfig } from '../types.ts'
import type { ComarkCompletion } from './render.ts'
import { snippet } from '@codemirror/autocomplete'
import { scopesAt } from '../bindings.ts'
import { configOf } from '../config.ts'
import { resolveContext } from '../context/resolve.ts'
import { docIndex } from '../document/index.ts'
import { coreProviders } from './core.ts'
import { renderInfo, sectionBoost, sectionFor } from './render.ts'
import { templateText, toSnippet } from './template.ts'

/** What the menu is about, shown as the section header (`::card › props`). */
export function breadcrumb(ctx: CursorContext): string {
  const owner = (o: Extract<CursorContext, { owner?: unknown }>['owner']) => {
    if (!o) return 'attributes'
    if (o.type === 'component') return `${o.inline ? ':' : '::'}${o.name}`
    if (o.type === 'slot') return `#${o.name}`
    return o.type
  }
  switch (ctx.kind) {
    case 'block': return 'Blocks'
    case 'component-name': return ctx.inline ? 'Inline' : 'Components'
    case 'attr-key': return `${owner(ctx.owner)} › ${ctx.prefix === '::' ? 'model' : ctx.prefix === ':' ? 'bindings' : ctx.owner.type === 'component' ? 'props' : 'attributes'}`
    case 'attr-value': return `${owner(ctx.owner)} › ${ctx.name}`
    case 'attr-class': return `${owner(ctx.owner)} › class`
    case 'attr-id': return `${owner(ctx.owner)} › id`
    case 'binding-path': return ctx.segments.length ? ctx.segments.join(' › ') : ctx.key ? `:${ctx.key} › bindings` : 'Bindings'
    case 'binding-default': return `${ctx.path} › fallback`
    case 'slot': return `::${ctx.component.name} › slots`
    case 'props-key': return ['::' + ctx.component.name, 'props', ...ctx.path].join(' › ')
    case 'props-value': return ['::' + ctx.component.name, ...ctx.path, ctx.key].join(' › ')
    case 'frontmatter-key': return ['frontmatter', ...ctx.path].join(' › ')
    case 'frontmatter-value': return ['frontmatter', ...ctx.path, ctx.key].join(' › ')
    case 'fence-lang': return 'Languages'
    case 'fence-meta': return `${ctx.lang} › meta`
    case 'fence-body': return ctx.lang
    case 'emoji': return 'Emoji'
    case 'link-url': return ctx.anchor ? 'Headings' : ctx.image ? 'Assets' : 'Links'
    case 'footnote': return 'Footnotes'
    case 'alert': return 'Alerts'
    case 'task': return 'Task'
    case 'html-tag': return 'HTML'
    case 'html-attr': return `<${ctx.tag}> › attributes`
    case 'math': return 'LaTeX'
    case 'inline': return 'Inline'
  }
}

/** Text the typed prefix may grow into without re-querying the providers. */
const VALID: Partial<Record<ContextKind, RegExp>> = {
  'block': /^[\w-]*$/,
  'component-name': /^:*[\w$.-]*$/,
  'attr-key': /^(?:::|:|@)?[\w-]*$/,
  'attr-value': /^[^"'}]*$/,
  'attr-class': /^[\w-]*$/,
  'attr-id': /^[\w-]*$/,
  'binding-path': /^[\w$-]*$/,
  'slot': /^#[\w-]*$/,
  'props-key': /^[\w$-]*$/,
  'frontmatter-key': /^[\w$-]*$/,
  'props-value': /^[^"'\n]*$/,
  'frontmatter-value': /^[^"'\n]*$/,
  'fence-lang': /^[\w+#.-]*$/,
  'fence-meta': /^\S*$/,
  'emoji': /^:[\w+-]*$/,
  'link-url': /^[^\s)]*$/,
  'footnote': /^[^\]\s]*$/,
  'alert': /^\[!?\w*$/,
  'task': /^\[[ xX]?$/,
  'html-tag': /^<\/?[\w-]*$/,
  'html-attr': /^[\w:@-]*$/,
  'math': /^\\[A-Za-z]*$/,
  'inline': /^[\w-]*$/,
}

export interface Collected {
  context: CursorContext
  items: Item[]
}

function providersOf(config: ResolvedConfig): CompletionProvider<any>[] {
  return [...coreProviders, ...config.plugins.flatMap(p => p.completions ?? [])]
}

/** Resolve the context and gather items from every provider for it. */
export async function collect(state: EditorState, pos: number, explicit = false, config = configOf(state)): Promise<Collected | null> {
  const context = resolveContext(state, pos, { explicit, slash: config.completion.slash })
  if (!context) return null
  const index = docIndex(state)
  let scopes: ReturnType<typeof scopesAt> | undefined
  const pctx: ProviderContext = {
    context,
    state,
    index,
    config,
    explicit,
    scopes: () => (scopes ??= scopesAt(state, index, pos, config)),
  }
  const items: Item[] = []
  const seen = new Set<string>()
  for (const provider of providersOf(config)) {
    if (!provider.kinds.includes(context.kind)) continue
    const out = await provider.provide(pctx as never)
    for (const item of out ?? []) {
      const key = `${item.label}\u0000${item.insert ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push(item)
    }
  }
  return { context, items }
}

/** A plain-data completion (headless). */
export interface CompleteItem {
  label: string
  /** Text inserted (template stops removed). */
  insert: string
  detail?: string
  type?: string
  section: string
  /** Picking it opens the next menu. */
  chain: boolean
}

/**
 * Completions at `pos`, without a view. Returns the context (what the cursor
 * is on) and the items a user would see (unfiltered by the typed prefix).
 */
export async function complete(state: EditorState, pos = state.selection.main.head, options: { explicit?: boolean } = {}): Promise<{ context: CursorContext, items: CompleteItem[] } | null> {
  const res = await collect(state, pos, options.explicit ?? false)
  if (!res) return null
  const crumb = breadcrumb(res.context)
  return {
    context: res.context,
    items: res.items.map(item => ({
      label: item.label,
      insert: templateText(item.insert ?? item.label),
      detail: item.detail,
      type: item.type,
      section: item.section ?? crumb,
      chain: !!item.chain,
    })),
  }
}

function toCompletion(item: Item, ctx: CursorContext, config: ResolvedConfig, crumb: string, order: number): ComarkCompletion {
  const chain = config.completion.chain && !!item.chain
  const slash = ctx.kind === 'block' && ctx.slash
  const apply: ComarkCompletion['apply'] = item.apply ?? ((view, completion, from, to) => {
    let start = slash ? from - 1 : from
    let end = to
    let template = item.insert ?? item.label
    if (item.exit) {
      const next = view.state.sliceDoc(to, to + 1)
      if (next === '"' || next === '\'') {
        end = to + 1
        template = `${template}${next}`
      }
    }
    if (start < 0) start = 0
    snippet(toSnippet(template))(view, completion, start, end)
  })
  const completion: ComarkCompletion = {
    label: item.label,
    detail: item.detail,
    type: item.type,
    boost: (item.boost ?? 0) + (item.section ? sectionBoost(item.section, item.type) : 0),
    sortText: `${String(order).padStart(4, '0')}${item.label}`,
    section: sectionFor(item.section ?? crumb, !item.section),
    apply,
    item,
    chain,
  }
  if (item.info && config.completion.info !== false) {
    const info = item.info
    completion.info = () => renderInfo(info)
  }
  return completion
}

/** The CodeMirror completion source (registered through language data by `comark()`). */
export async function comarkCompletionSource(context: CompletionContext): Promise<CompletionResult | null> {
  const config = configOf(context.state)
  const res = await collect(context.state, context.pos, context.explicit, config)
  if (!res || !res.items.length || context.aborted) return null
  const crumb = breadcrumb(res.context)
  const items = res.items.slice(0, config.completion.maxItems * 4)
  return {
    from: res.context.from,
    to: res.context.to,
    options: items.map((item, i) => toCompletion(item, res.context, config, crumb, i)),
    validFor: VALID[res.context.kind],
  }
}
