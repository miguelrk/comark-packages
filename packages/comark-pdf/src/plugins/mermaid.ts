import { Text, Box } from '@jasy/pdf'
import type { ElementNode } from 'comark'
import type { JasyComponentFn } from '../jasy.ts'

export * from 'comark/plugins/mermaid'
export { default } from 'comark/plugins/mermaid'

/**
 * jasy component for mermaid nodes.
 * Mermaid emits SVG/HTML which jasy cannot consume, so we render the diagram
 * source as a monospace code block. For rich diagrams, rasterize to an image.
 */
export const Mermaid: JasyComponentFn = ([, attrs]: ElementNode) => {
  const content = String(attrs.content ?? '')
  return Box(
    { bg: '#f6f8fa', padding: 10, radius: 4 },
    [Text(content, { font: 'Courier', size: 10 })],
  )
}
