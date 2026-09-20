import type { ElementNode, MarkdownDocument, Node } from 'comark'

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
])

const childrenOf = (node: ElementNode): Node[] => node.slice(2) as Node[]

const attrString = (attrs: unknown, key: string): string => {
  if (!attrs || typeof attrs !== 'object') return ''
  const value = (attrs as Record<string, unknown>)[key]
  return value == null ? '' : String(value)
}

const joinInline = (nodes: Node[]): string => nodes.map(node => nodeToText(node)).join('')

const nodeToText = (node: Node): string => {
  if (typeof node === 'string') return node
  if (!Array.isArray(node) || node[0] === null) return ''

  const element = node as ElementNode
  const tag = String(element[0])
  const attrs = element[1]
  const children = childrenOf(element)

  if (tag === 'br') return '\n'
  if (tag === 'hr' || tag === 'email-divider') return ''

  if (tag === 'img') return attrString(attrs, 'alt') || attrString(attrs, 'src')

  if (tag === 'a' || tag === 'email-button') {
    const href = attrString(attrs, 'href')
    const label = joinInline(children).trim()
    if (href && label && href !== label) return `${label} (${href})`
    return label || href
  }

  if (tag === 'li') {
    const body = joinInline(children).trim()
    return body ? `- ${body}` : ''
  }

  if (tag === 'ul' || tag === 'ol') {
    return children.map(child => nodeToText(child).trim()).filter(Boolean).join('\n')
  }

  if (tag === 'tr') {
    return children.map(child => nodeToText(child).trim()).filter(Boolean).join('\t')
  }

  if (tag === 'email-columns' || tag === 'table' || tag === 'thead' || tag === 'tbody') {
    return children.map(child => nodeToText(child).trim()).filter(Boolean).join('\n')
  }

  return joinInline(children)
}

export const documentToText = (
  document: MarkdownDocument | { nodes: MarkdownDocument['nodes'] },
): string =>
  document.nodes
    .map((node) => {
      if (typeof node !== 'string' && Array.isArray(node) && BLOCK_TAGS.has(String(node[0]))) {
        return nodeToText(node).trim()
      }
      return nodeToText(node).trim()
    })
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
