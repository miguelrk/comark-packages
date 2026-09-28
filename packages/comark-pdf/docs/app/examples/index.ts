import type { ElementNode } from 'comark'
import type { JasyComponentFn, PdfRendererOptions } from 'comark-pdf'
import rangi from 'comark/plugins/rangi'
import math, { Math } from 'comark-pdf/plugins/math'
import mermaid, { Mermaid } from 'comark-pdf/plugins/mermaid'
import { Box, Text } from '@jasy/pdf'
import { invoiceMarkdown } from './invoice.ts'
import { markdownSample } from './markdown.ts'
import { Barcode, productLabelMarkdown } from './product-label.ts'

export interface DemoExample {
  id: string
  label: string
  markdown: string
  plugins?: PdfRendererOptions['plugins']
  components?: Record<string, JasyComponentFn>
  visuals?: PdfRendererOptions['visuals']
  data?: PdfRendererOptions['data']
}

const Alert: JasyComponentFn = async ([, , ...children]: ElementNode, ctx) => {
  const inner = await ctx.mapNodes(children)
  return Box(
    { bg: '#fff8e1', padding: 10, radius: 4, borderLeft: '#f0c14b', borderWidth: 3 },
    inner.length > 0 ? inner : [Text('')],
  )
}

export const examples: DemoExample[] = [
  {
    id: 'markdown',
    label: 'Markdown',
    markdown: markdownSample,
    plugins: [rangi(), math(), mermaid()],
    components: { Math, Mermaid, alert: Alert },
    visuals: {
      image: 'embed',
      section: { rule: true },
      table: { keyValue: true },
      quote: { bg: '#f4f4f5', bar: '#aaaaaa', pad: { left: 8, top: 4, bottom: 4 } },
    },
    data: {
      name: 'Ada Lovelace',
      showTerms: true,
      items: [{ label: 'Paper A4' }, { label: 'Black ink' }],
      snippet: 'This line comes from `data.snippet` through `::include`.',
    },
  },
  {
    id: 'invoice',
    label: 'Invoice',
    markdown: invoiceMarkdown,
    visuals: { table: { keyValue: true } },
  },
  {
    id: 'product-label',
    label: 'Product label',
    markdown: productLabelMarkdown,
    components: { barcode: Barcode },
  },
]
