import type { ElementNode, MarkdownDocument, Node } from 'comark'
import type { BindingScope } from './binding.ts'
import {
  resolveBoundAttrs,
  resolveBindingText,
  resolveForIterations,
  selectForBranch,
  selectIfBranch,
  shouldRenderIf,
} from './binding.ts'

const BLOCK_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'table',
  'thead',
  'tbody',
  'email-columns',
  'if',
  'for',
  'include',
])

const childrenOf = (node: ElementNode): Node[] => node.slice(2) as Node[]

const attrString = (attrs: Record<string, unknown>, key: string): string => {
  const value = attrs[key]
  return value == null ? '' : String(value)
}

const joinInline = (nodes: Node[], scope: BindingScope): string =>
  nodes.map(node => nodeToText(node, scope)).join('')

const joinBlocks = (nodes: Node[], scope: BindingScope): string =>
  nodes.map(node => nodeToText(node, scope).trim()).filter(Boolean).join('\n\n')

const nodeToText = (node: Node, scope: BindingScope): string => {
  if (typeof node === 'string') return node
  if (!Array.isArray(node) || node[0] === null) return ''

  const element = node as ElementNode
  const tag = String(element[0])
  const attrs = resolveBoundAttrs((element[1] ?? {}) as Record<string, unknown>, scope)
  const children = childrenOf(element)

  if (tag === 'binding') {
    return resolveBindingText((element[1] ?? {}) as Record<string, unknown>, scope)
  }

  if (tag === 'if') {
    const branch = selectIfBranch(children, shouldRenderIf(attrs))
    return branch?.length ? joinBlocks(branch, scope) : ''
  }

  if (tag === 'for') {
    const iterations = resolveForIterations(attrs, scope.props ?? {})
    const branch = selectForBranch(children, iterations.length === 0)
    if (!iterations.length) return branch.length ? joinBlocks(branch, scope) : ''
    return iterations
      .map(iteration => joinBlocks(branch, { ...scope, props: iteration.props }))
      .filter(Boolean)
      .join('\n\n')
  }

  if (tag === 'br') return '\n'
  if (tag === 'hr' || tag === 'email-divider') return ''

  if (tag === 'img') return attrString(attrs, 'alt') || attrString(attrs, 'src')

  if (tag === 'a' || tag === 'email-button') {
    const href = attrString(attrs, 'href')
    const label = joinInline(children, scope).trim()
    if (href && label && href !== label) return `${label} (${href})`
    return label || href
  }

  if (tag === 'li') {
    const body = joinInline(children, scope).trim()
    return body ? `- ${body}` : ''
  }

  if (tag === 'ul' || tag === 'ol') {
    return children.map(child => nodeToText(child, scope).trim()).filter(Boolean).join('\n')
  }

  if (tag === 'tr') {
    return children.map(child => nodeToText(child, scope).trim()).filter(Boolean).join('\t')
  }

  if (tag === 'email-columns' || tag === 'table' || tag === 'thead' || tag === 'tbody') {
    return children.map(child => nodeToText(child, scope).trim()).filter(Boolean).join('\n')
  }

  return joinInline(children, scope)
}

export const documentToText = (
  document: MarkdownDocument | { nodes: MarkdownDocument['nodes'] },
  scope: BindingScope = {},
): string =>
  document.nodes
    .map((node) => {
      if (typeof node !== 'string' && Array.isArray(node) && BLOCK_TAGS.has(String(node[0]))) {
        return nodeToText(node, scope).trim()
      }
      return nodeToText(node, scope).trim()
    })
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
