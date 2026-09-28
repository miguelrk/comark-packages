/**
 * Binding scopes. Comark renderers resolve `:prop="path"` and `{{ path }}`
 * against `{ frontmatter, meta, data, props }` (`resolveAttributes`), where
 * `props` are the props of the nearest enclosing component that has its own
 * attributes. Components can add names (loop variables) with `scope`.
 */
import type { EditorState } from '@codemirror/state'
import type { DocIndex } from './document/index.ts'
import type { OutlineNode } from './document/outline.ts'
import type { ComponentDef, JSONSchema, PropType, ResolvedConfig, ScopeRoot, Shape } from './types.ts'

/** The shape of a sample value. `closed` marks it as complete (the live frontmatter). */
export function shapeOf(value: unknown, closed = false, depth = 6): Shape {
  if (value === null) return { type: 'null', value, closed }
  if (Array.isArray(value)) {
    const items = value.slice(0, 20).map(v => shapeOf(v, closed, depth - 1))
    return { type: 'array', value, closed, items: items.length ? mergeShapes(items) : undefined }
  }
  if (typeof value === 'object') {
    if (depth <= 0) return { type: 'object', value }
    const properties: Record<string, Shape> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) properties[k] = shapeOf(v, closed, depth - 1)
    return { type: 'object', value, closed, properties }
  }
  const type = typeof value
  return { type: type === 'string' || type === 'number' || type === 'boolean' ? type : 'any', value, closed }
}

function mergeShapes(shapes: readonly Shape[]): Shape {
  const first = shapes[0]!
  if (first.type !== 'object') return { ...first, value: undefined }
  const properties: Record<string, Shape> = {}
  for (const s of shapes) {
    for (const [k, v] of Object.entries(s.properties ?? {})) properties[k] ??= v
  }
  return { type: 'object', closed: first.closed, properties }
}

export function shapeFromSchema(schema: JSONSchema, closed = true): Shape {
  const t = Array.isArray(schema.type) ? schema.type.find(x => x !== 'null') : schema.type
  const type = (t === 'integer' ? 'number' : t) as PropType | undefined
  const shape: Shape = { type: type ?? (schema.properties ? 'object' : undefined), description: schema.description, enum: schema.enum, closed, value: schema.default }
  if (schema.properties) {
    shape.properties = {}
    for (const [k, v] of Object.entries(schema.properties)) shape.properties[k] = shapeFromSchema(v, closed)
  }
  if (schema.items) shape.items = shapeFromSchema(schema.items, closed)
  return shape
}

/** Add the keys of `extra` that `target` does not have (the first provider of a key wins). */
function mergeInto(target: Shape, extra: Shape): Shape {
  if (!extra.properties) return target
  const properties = { ...target.properties }
  for (const [k, v] of Object.entries(extra.properties)) properties[k] ??= v
  return { ...target, type: 'object', properties }
}

/** The shape at a path below a root shape. Numeric segments index arrays. */
export function shapeAt(shape: Shape | undefined, segments: readonly string[]): Shape | undefined {
  let cur = shape
  for (const seg of segments) {
    if (!cur) return undefined
    if (cur.type === 'array') {
      if (seg === 'length') return { type: 'number', value: Array.isArray(cur.value) ? cur.value.length : undefined }
      const item = Array.isArray(cur.value) && /^\d+$/.test(seg) ? (cur.value[Number(seg)] as unknown) : undefined
      cur = item !== undefined ? shapeOf(item, cur.closed) : cur.items
      continue
    }
    cur = cur.properties?.[seg]
  }
  return cur
}

function propsShape(def: ComponentDef | undefined, actual: Record<string, unknown>): Shape {
  const properties: Record<string, Shape> = {}
  for (const [name, prop] of Object.entries(def?.props ?? {})) {
    properties[name] = { type: prop.type, description: prop.description, enum: prop.enum, value: prop.default }
  }
  for (const [key, value] of Object.entries(actual)) {
    const name = key.replace(/^::?|^@/, '')
    if (key.startsWith(':')) properties[name] ??= { type: 'any', description: `bound to ${String(value)}` }
    else properties[name] = { ...properties[name], ...shapeOf(value), description: properties[name]?.description }
  }
  return { type: 'object', properties }
}

/** `data`/`meta` from a sample value or a JSON Schema. */
function hostShape(value: unknown, schema: JSONSchema | undefined): Shape | undefined {
  if (schema) return shapeFromSchema(schema)
  if (value !== undefined) return shapeOf(value)
  return undefined
}

/** Binding roots visible at a position, in the order the menu shows them. */
export function scopesAt(state: EditorState, index: DocIndex, pos: number, config: ResolvedConfig): ScopeRoot[] {
  const roots: ScopeRoot[] = []
  const add = (root: ScopeRoot) => {
    const existing = roots.find(r => r.name === root.name)
    if (existing) existing.shape = mergeInto(existing.shape, root.shape)
    else roots.push({ ...root })
  }

  add({ name: 'frontmatter', description: 'This document\'s frontmatter', shape: shapeOf(index.frontmatter.value, true) })

  const line = state.doc.lineAt(pos).number
  const stack = index.stackAt(line)
  // a component's own attribute line binds against its parent's props
  const onOpener = index.outline.find(n => n.kind === 'component' && n.line === line)
  const owner = [...stack].reverse().find(n => Object.keys(index.propsOf(n)).length)
  if (owner && owner !== onOpener) {
    add({ name: 'props', description: `Props of ::${owner.name}`, shape: propsShape(config.components.get(owner.name), index.propsOf(owner)) })
  }

  const { options } = config
  const data = hostShape(options.data, options.dataSchema)
  if (data) add({ name: 'data', description: 'Data passed to the renderer', shape: data, writable: true })
  const meta = hostShape(options.meta, options.metaSchema)
  if (meta) add({ name: 'meta', description: 'Document meta', shape: meta })

  for (const plugin of config.plugins) {
    for (const provider of plugin.scopes ?? []) {
      const out = provider({ state, index, pos })
      for (const root of out ? (Array.isArray(out) ? out : [out]) as ScopeRoot[] : []) add(root)
    }
  }

  // component scopes (loop variables), innermost last so they win
  for (const node of stack) addComponentScope(node, index, config, roots, add)
  return roots
}

function addComponentScope(node: OutlineNode, index: DocIndex, config: ResolvedConfig, roots: ScopeRoot[], add: (r: ScopeRoot) => void) {
  const def = config.components.get(node.name)
  if (!def?.scope) return
  const props = index.propsOf(node)
  for (const spec of def.scope) {
    const nameValue = spec.nameProp ? props[spec.nameProp] : undefined
    const name = typeof nameValue === 'string' && nameValue ? nameValue : spec.name
    let shape: Shape = { type: 'any' }
    const source = spec.source ? (props[`:${spec.source}`] ?? props[spec.source]) : undefined
    if (typeof source === 'string') {
      const [root, ...rest] = source.split('.')
      const target = shapeAt(roots.find(r => r.name === root)?.shape, rest)
      if (target) shape = spec.element ? (target.items ?? { type: 'any' }) : target
    }
    add({ name, description: spec.description ?? `from ::${node.name}`, shape })
  }
}

/** A short preview of a value for the detail column. */
export function preview(value: unknown, max = 28): string {
  if (value === undefined) return ''
  const text = typeof value === 'string' ? JSON.stringify(value) : Array.isArray(value) ? `[${value.length}]` : value && typeof value === 'object' ? '{…}' : String(value)
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
