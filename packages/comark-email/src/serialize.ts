import type { MjmlNode } from './types.ts'

/** Escape characters that are invalid inside XML text content or attribute values. */
const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Tags whose text content is metadata (not HTML) and must be XML-escaped.
 * e.g. mj-title with "R&D" → "R&amp;D".
 * Body content tags (mj-text, mj-raw, mj-table, etc.) emit raw HTML and are NOT escaped.
 */
const METADATA_TAGS = new Set(['mj-title', 'mj-preview'])

/**
 * Serialize a MjmlNode tree to an MJML XML string.
 *
 * Used for tests, debugging, and as an alternative input to compileMjml.
 */
export const serializeMjml = (node: MjmlNode, depth = 0): string => {
  const indent = ' '.repeat(depth)
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join('')

  if (!node.children?.length && node.content === undefined) {
    return `${indent}<${node.tagName}${attrs} />`
  }

  const isMetadata = METADATA_TAGS.has(node.tagName)

  if (!node.children?.length && typeof node.content === 'string' && !node.content.includes('\n')) {
    const content = isMetadata ? escapeXml(node.content) : node.content
    return `${indent}<${node.tagName}${attrs}>${content}</${node.tagName}>`
  }

  const inner: string[] = []
  if (node.content !== undefined) {
    inner.push(isMetadata ? escapeXml(node.content) : node.content)
  }
  for (const child of node.children ?? []) {
    inner.push(serializeMjml(child, depth + 1))
  }
  return `${indent}<${node.tagName}${attrs}>\n${inner.join('\n')}\n${indent}</${node.tagName}>`
}
