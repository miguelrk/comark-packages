import type { Node } from 'comark'

export type BindingScope = {
  data?: Record<string, unknown>
  frontmatter?: Record<string, unknown>
  props?: Record<string, unknown>
  meta?: Record<string, unknown>
}

const NAMESPACES = new Set(['data', 'frontmatter', 'props', 'meta'])

const BINDING_IN_STRING = /\{\{\s*([^}|]+?)\s*(?:\|\|\s*([^}]+?)\s*)?\}\}/g

const IF_COMPARISON_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] as const

type IfComparisonOperator = (typeof IF_COMPARISON_OPERATORS)[number]

const get = (source: unknown, path: string): unknown => {
  if (!path) return source
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, source)
}

export const resolvePath = (path: string, scope: BindingScope): unknown => {
  const root = {
    data: scope.data ?? {},
    frontmatter: scope.frontmatter ?? {},
    props: scope.props ?? {},
    meta: scope.meta ?? {},
  }
  const direct = get(root, path)
  if (direct !== undefined) return direct
  const first = path.split('.')[0]
  if (first && !NAMESPACES.has(first)) return get(root.data, path)
  return undefined
}

const resolveFallback = (fallback: string | undefined, scope: BindingScope): string => {
  if (fallback == null) return ''
  const alt = fallback.trim()
  if (!alt) return ''
  const fromPath = resolvePath(alt, scope)
  if (fromPath != null && fromPath !== '') return String(fromPath)
  return alt
}

export const interpolateBindings = (value: string, scope: BindingScope): string =>
  value.replace(BINDING_IN_STRING, (_match, path: string, fallback?: string) => {
    const resolved = resolvePath(path.trim(), scope)
    if (resolved != null && resolved !== '') return String(resolved)
    return resolveFallback(fallback, scope)
  })

export const resolveBoundAttrs = (
  attrs: Record<string, unknown>,
  scope: BindingScope,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith(':') && typeof value === 'string') {
      out[key.slice(1)] = resolvePath(value, scope)
      continue
    }
    if (typeof value === 'string' && value.includes('{{')) {
      out[key] = interpolateBindings(value, scope)
      continue
    }
    out[key] = value
  }
  return out
}

const compareIfValue = (operator: IfComparisonOperator, value: unknown, expected: unknown): boolean => {
  switch (operator) {
    case 'eq':
      return value === expected
    case 'neq':
      return value !== expected
    case 'gt':
      return (value as number) > (expected as number)
    case 'gte':
      return (value as number) >= (expected as number)
    case 'lt':
      return (value as number) < (expected as number)
    case 'lte':
      return (value as number) <= (expected as number)
  }
}

export const shouldRenderIf = (props: Record<string, unknown>): boolean => {
  let hasComparison = false
  for (const operator of IF_COMPARISON_OPERATORS) {
    if (!Object.prototype.hasOwnProperty.call(props, operator)) continue
    hasComparison = true
    if (!Object.prototype.hasOwnProperty.call(props, 'value') || props.value === undefined) return false
    const expected = props[operator]
    if (expected === undefined || !compareIfValue(operator, props.value, expected)) return false
  }
  return hasComparison || Boolean(props.value)
}

const slotName = (attrs: Record<string, unknown>): string | undefined => {
  const slotKey = Object.keys(attrs).find(key => key.startsWith('#') || key.startsWith('v-slot:'))
  return (attrs.name as string | undefined)
    ?? (slotKey?.startsWith('#') ? slotKey.slice(1) : slotKey?.slice(7))
}

export const selectIfBranch = (children: Node[], matches: boolean): Node[] | undefined => {
  const regularChildren: Node[] = []
  let defaultSlot: Node[] | undefined
  let elseSlot: Node[] | undefined
  for (const child of children) {
    if (Array.isArray(child) && child[0] === 'template') {
      const name = slotName(child[1] as Record<string, unknown>)
      if (name) {
        if (name === 'default') defaultSlot = child.slice(2) as Node[]
        if (name === 'else') elseSlot = child.slice(2) as Node[]
        continue
      }
    }
    regularChildren.push(child)
  }
  return matches ? (defaultSlot ?? regularChildren) : elseSlot
}

export const selectForBranch = (children: Node[], empty: boolean): Node[] => {
  const regular: Node[] = []
  let defaultSlot: Node[] | undefined
  let emptySlot: Node[] | undefined
  for (const child of children) {
    if (Array.isArray(child) && child[0] === 'template') {
      const name = slotName(child[1] as Record<string, unknown>)
      if (name) {
        if (name === 'default') defaultSlot = child.slice(2) as Node[]
        if (name === 'empty') emptySlot = child.slice(2) as Node[]
        continue
      }
    }
    regular.push(child)
  }
  return empty ? (emptySlot ?? []) : (defaultSlot ?? regular)
}

const forAlias = (value: unknown, fallback?: string): string | undefined => {
  if (value === undefined) return fallback
  if (
    typeof value !== 'string'
    || !value
    || value.includes('.')
    || ['__proto__', 'prototype', 'constructor'].includes(value)
  ) {
    throw new Error('For aliases must be non-empty names without dots or prototype keys')
  }
  return value
}

export const resolveForIterations = (
  props: { each?: unknown, item?: unknown, index?: unknown, key?: unknown },
  parentProps: Record<string, unknown>,
): Array<{ key: string | number, props: Record<string, unknown> }> => {
  const item = forAlias(props.item, 'item')!
  const index = forAlias(props.index)
  if (index === item) throw new Error('For item and index aliases must be different')
  if (props.each == null) return []
  if (!Array.isArray(props.each)) throw new Error('For each must be an array')
  if (props.key !== undefined && (typeof props.key !== 'string' || !props.key)) {
    throw new Error('For key must be a non-empty item property path')
  }
  const keys = new Set<string | number>()
  return props.each.map((value: unknown, position: number) => {
    const key = props.key === undefined ? position : get(value, props.key as string)
    if ((typeof key !== 'string' && typeof key !== 'number') || (typeof key === 'number' && !Number.isFinite(key))) {
      throw new Error('For item keys must be strings or finite numbers')
    }
    if (keys.has(key)) throw new Error(`Duplicate For key: ${key}`)
    keys.add(key)
    return {
      key,
      props: { ...parentProps, [item]: value, ...(index ? { [index]: position } : {}) },
    }
  })
}
