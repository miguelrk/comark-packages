import { Text, Box } from '@jasy/pdf'
import type { ElementNode } from 'comark'
import type { JasyComponentFn } from '../jasy.ts'

export * from 'comark/plugins/math'
export { default } from 'comark/plugins/math'

/**
 * jasy component for math nodes.
 * KaTeX emits HTML which jasy cannot consume, so we render the LaTeX source
 * as monospace text. For rich math, rasterize to an image.
 */
export const Math: JasyComponentFn = ([, attrs]: ElementNode) => {
  const content = String(attrs.content ?? '')
  const isInline = String(attrs.class ?? '').includes('inline')

  if (isInline) {
    return Text(content, { font: 'Courier', size: 11 })
  }
  return Box(
    { bg: '#f6f8fa', padding: 10, radius: 4 },
    [Text(content, { font: 'Courier', size: 11 })],
  )
}
