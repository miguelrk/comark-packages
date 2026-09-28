/**
 * Item builders shared by the component and binding plugins.
 */
import type { EditorState } from '@codemirror/state'
import type { ContextOf } from '../context/types.ts'
import type { ComponentDef, InfoDocs, Item, PropDef, ProviderContext, Shape } from '../types.ts'
import { preview, shapeAt } from '../bindings.ts'

export function propDetail(prop: PropDef): string {
  if (prop.enum) return prop.enum.map(v => JSON.stringify(v)).join(' | ')
  return prop.type ?? 'any'
}

export function componentDocs(def: ComponentDef): InfoDocs {
  const marker = def.kind === 'inline' ? ':' : '::'
  return {
    title: `${marker}${def.name}`,
    description: def.description,
    rows: [
      ...Object.entries(def.props ?? {}).map(([name, p]) => [name, `${propDetail(p)}${p.required ? ' · required' : ''}`, p.description] as const),
      ...(def.slots ?? []).filter(s => s.name !== 'default').map(s => [`#${s.name}`, 'slot', s.description] as const),
    ],
    example: def.example?.replace(/\$\d|\$\{\d+(?::([^}]*))?\}/g, (_, t: string | undefined) => t ?? ''),
    link: def.docs,
  }
}

/** Indentation of continuation lines for text inserted at `from` (inside list items and quotes). */
export function continuation(state: EditorState, from: number): string {
  const line = state.doc.lineAt(from)
  const lead = line.text.slice(0, from - line.from)
  return lead.replace(/>[ \t]?/g, m => m).replace(/[^\s>]/g, ' ')
}

const hasProps = (def: ComponentDef) => Object.keys(def.props ?? {}).length > 0

/** A block component item: opener, body line and closer, cursor in `{}` when it has props. */
export function blockComponentItem(def: ComponentDef, colons: number, indent: string, label = `${':'.repeat(colons)}${def.name}`): Item {
  const marker = ':'.repeat(colons)
  const props = hasProps(def)
  return {
    label,
    insert: props ? `${marker}${def.name}{$1}\n${indent}$2\n${indent}${marker}` : `${marker}${def.name}\n${indent}$0\n${indent}${marker}`,
    detail: def.description ?? def.group,
    info: componentDocs(def),
    type: 'component',
    section: def.group ?? 'Components',
    chain: props,
    drill: props,
    commit: props ? '{' : undefined,
  }
}

export function inlineComponentItem(def: ComponentDef): Item {
  const props = hasProps(def)
  const label = def.slots?.some(s => s.name === 'default')
  return {
    label: `:${def.name}`,
    insert: props ? `:${def.name}${label ? '[$1]' : ''}{$0}` : `:${def.name}${label ? '[$0]' : ''}`,
    detail: def.description ?? def.group,
    info: componentDocs(def),
    type: 'inline-component',
    section: 'Inline components',
    chain: props && !label,
    drill: props,
    commit: props ? '{' : undefined,
  }
}

/** Prop items for an attribute block. */
export function propItems(ctx: ContextOf<'attr-key'>, def: ComponentDef | undefined, used: ReadonlySet<string> = new Set()): Item[] {
  const sep = ctx.separated ? '' : ' '
  const present = new Set(ctx.present)
  const props = Object.entries(def?.props ?? {}).filter(([name]) => !present.has(name))
  const extra = [...used].filter(name => !def?.props?.[name] && !present.has(name)).map(name => [name, { type: 'string' } as PropDef] as const)
  const all = [...props, ...extra]
  const order = (p: PropDef) => (p.required ? 0 : 1)
  all.sort((a, b) => order(a[1]) - order(b[1]))
  const info = (name: string, p: PropDef): InfoDocs => ({
    title: name,
    description: p.description,
    rows: [['type', propDetail(p)], ...(p.default !== undefined ? [['default', JSON.stringify(p.default)] as const] : []), ...(p.required ? [['required', 'yes'] as const] : [])],
  })
  if (ctx.prefix === ':' || ctx.prefix === '::') {
    const model = ctx.prefix === '::'
    return all
      .filter(([, p]) => (model ? p.model : p.bindable !== false))
      .map(([name, p]) => ({
        label: `${ctx.prefix}${name}`,
        insert: `${sep}${ctx.prefix}${name}="$0"`,
        detail: model ? 'two-way binding' : `bind ${propDetail(p)}`,
        info: info(name, p),
        type: 'prop-bound',
        boost: p.required ? 10 : 0,
        chain: true,
        drill: true,
        commit: '=',
      }))
  }
  if (ctx.prefix === '@') return []
  return all.map(([name, p]) => {
    const flag = p.type === 'boolean'
    return {
      label: name,
      insert: flag ? `${sep}${name}` : `${sep}${name}="$0"`,
      detail: `${propDetail(p)}${p.required ? ' · required' : ''}`,
      info: info(name, p),
      type: 'prop',
      boost: p.required ? 10 : 0,
      chain: true,
      drill: !flag,
      commit: flag ? undefined : '=',
    }
  })
}

/** Generic attributes: class, id, style. */
export function genericAttrItems(ctx: ContextOf<'attr-key'>): Item[] {
  if (ctx.prefix) return []
  const sep = ctx.separated ? '' : ' '
  const present = new Set(ctx.present)
  const out: Item[] = [
    { label: '.class', insert: `${sep}.$0`, detail: 'class', type: 'class', section: 'Attributes', chain: true },
    { label: '#id', insert: `${sep}#$0`, detail: 'id', type: 'id', section: 'Attributes', chain: true },
    { label: 'style', insert: `${sep}style="$0"`, detail: 'inline style', type: 'prop', section: 'Attributes' },
  ]
  return out.filter(i => !(i.label === '#id' && present.has('id')) && !(i.label === 'style' && present.has('style')))
}

/** Values for a prop: enum, booleans, the default, and values used elsewhere. */
export function valueItems(prop: PropDef | undefined, used: Iterable<string>, name: string): Item[] {
  const values = new Map<string, Item>()
  const add = (value: string, detail?: string) => {
    if (values.has(value)) return
    values.set(value, {
      label: value,
      detail: detail ?? name,
      type: 'value',
      exit: true,
      chain: true,
      swatch: /^(?:#[\da-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i.test(value) ? value : undefined,
    })
  }
  for (const v of prop?.enum ?? []) add(String(v), v === prop?.default ? 'default' : undefined)
  if (prop?.type === 'boolean') {
    add('true')
    add('false')
  }
  if (prop?.default !== undefined) add(String(prop.default), 'default')
  for (const v of used) add(v, 'used here')
  return [...values.values()]
}

/** Binding path items (roots, then keys of the shape at the typed path). */
export function bindingItems(pctx: ProviderContext<'binding-path'>): Item[] {
  const ctx = pctx.context
  const bound = ctx.mode !== 'interpolation'
  const roots = pctx.scopes().filter(r => ctx.mode !== 'model' || r.writable)
  if (!ctx.segments.length) {
    const items: Item[] = roots.map(root => ({
      label: root.name,
      insert: `${root.name}.`,
      detail: root.shape.properties ? `${Object.keys(root.shape.properties).length} keys` : root.shape.type,
      info: { title: root.name, description: root.description, value: root.shape.value },
      type: 'binding-root',
      chain: true,
      drill: true,
      commit: '.',
      boost: root.name === 'props' ? 2 : 0,
    }))
    // literals for bound props
    if (ctx.mode === 'bound' && ctx.owner?.type === 'component' && ctx.key) {
      const prop = pctx.config.components.get(ctx.owner.name)?.props?.[ctx.key]
      if (prop?.type === 'boolean') items.push({ label: 'true', type: 'value', section: 'Values', exit: true, chain: true }, { label: 'false', type: 'value', section: 'Values', exit: true, chain: true })
    }
    return items
  }
  const [rootName, ...rest] = ctx.segments
  const root = roots.find(r => r.name === rootName)
  const shape = shapeAt(root?.shape, rest)
  return childItems(shape, bound)
}

function childItems(shape: Shape | undefined, bound: boolean): Item[] {
  if (!shape) return []
  const entries: [string, Shape][] = []
  if (shape.type === 'array') {
    const n = Array.isArray(shape.value) ? Math.min(shape.value.length, 5) : 1
    for (let i = 0; i < n; i++) entries.push([String(i), shapeAt(shape, [String(i)]) ?? { type: 'any' }])
    entries.push(['length', { type: 'number', value: Array.isArray(shape.value) ? shape.value.length : undefined }])
  }
  else for (const [k, v] of Object.entries(shape.properties ?? {})) entries.push([k, v])
  return entries.map(([key, child]) => {
    const nested = child.type === 'object' || child.type === 'array'
    return {
      label: key,
      insert: nested ? `${key}.` : key,
      detail: nested ? (child.type === 'array' ? `list${Array.isArray(child.value) ? ` [${child.value.length}]` : ''}` : 'object') : (preview(child.value) || child.type),
      info: { title: key, description: child.description, value: child.value },
      type: nested ? 'binding-key' : 'binding-leaf',
      chain: nested || bound,
      drill: nested,
      commit: nested ? '.' : undefined,
      exit: !nested && bound,
    }
  })
}
