import { describe, expect, it } from 'vitest'
import { parseMarkdown } from 'comark'
import { createPdfRenderer, renderPdf, renderPdfFromDocument, Include } from '../src/index.ts'
import { interpolateBindings } from '../src/binding.ts'
import math, { Math as MathComponent } from '../src/plugins/math.ts'
import { PageBreak } from '../src/plugins/page-break.ts'
import { BASIC_MARKDOWN, ADVANCED_MARKDOWN } from './fixtures/markdown.ts'

const isPdf = (bytes: Uint8Array) =>
  Buffer.from(bytes.slice(0, 4)).toString('ascii') === '%PDF'

describe('renderPdf', () => {
  it('returns PDF bytes', async () => {
    const bytes = await renderPdf('# Hello')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
    expect(isPdf(bytes)).toBe(true)
  })

  it('renders with custom width/height page size', async () => {
    const { Text } = await import('@jasy/pdf')
    const bytes = await renderPdf('::label\n::', {
      pdf: { width: '50mm', height: '65mm', margin: '3.5mm' },
      components: {
        label: () => Text('Label'),
      },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('reads pdf config from frontmatter', async () => {
    const bytes = await renderPdf('---\npdf:\n  format: A4\n  orientation: landscape\n---\n\n# Doc')
    expect(isPdf(bytes)).toBe(true)
  })

  it('merges options.pdf over frontmatter pdf', async () => {
    const bytes = await renderPdf('---\npdf:\n  format: A4\n  margin: 10mm\n---\n# Doc', {
      pdf: { margin: '25mm' },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('renders with header and footer page tokens', async () => {
    const bytes = await renderPdf('# Doc', {
      pdf: { format: 'A4', footer: 'Page {{ page }} of {{ totalPages }}' },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('renders basic markdown content', async () => {
    const bytes = await renderPdf('**Bold** and _italic_')
    expect(isPdf(bytes)).toBe(true)
  })

  it('applies custom components via JasyComponentFn', async () => {
    const { Text } = await import('@jasy/pdf')
    const bytes = await renderPdf('::note\nHello\n::', {
      components: {
        note: () => Text('Hello from note'),
      },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('renders basic fixture — multi-page document', async () => {
    const bytes = await renderPdf(BASIC_MARKDOWN)
    expect(isPdf(bytes)).toBe(true)
    expect(bytes.length).toBeGreaterThan(1000)
  })

  it('renders advanced fixture — header/footer tokens', async () => {
    const bytes = await renderPdf(ADVANCED_MARKDOWN)
    expect(isPdf(bytes)).toBe(true)
  })

  it('renders advanced fixture with math plugin', async () => {
    const bytes = await renderPdf(ADVANCED_MARKDOWN, {
      plugins: [math()],
      components: { Math: MathComponent },
    })
    expect(isPdf(bytes)).toBe(true)
  })
})

describe('createPdfRenderer', () => {
  it('creates a reusable render function', async () => {
    const render = createPdfRenderer({ pdf: { format: 'A4' } })
    const [bytes1, bytes2] = await Promise.all([render('# First'), render('# Second')])
    expect(isPdf(bytes1)).toBe(true)
    expect(isPdf(bytes2)).toBe(true)
  })
})

describe('renderPdfFromDocument', () => {
  it('renders from a pre-parsed document', async () => {
    const doc = await parseMarkdown('# Title\n\nParagraph.')
    const bytes = await renderPdfFromDocument(doc, { pdf: { format: 'A4' } })
    expect(isPdf(bytes)).toBe(true)
  })

  it('reads pdf config from frontmatter', async () => {
    const doc = await parseMarkdown(BASIC_MARKDOWN)
    const bytes = await renderPdfFromDocument(doc)
    expect(isPdf(bytes)).toBe(true)
  })

  it('PageBreak component with type=before produces valid PDF bytes', async () => {
    const doc = await parseMarkdown('Before\n\n::page-break{type="before"}\n::\n\nAfter')
    const bytes = await renderPdfFromDocument(doc, { components: { 'page-break': PageBreak } })
    expect(isPdf(bytes)).toBe(true)
  })

  it('default PageBreak component is registered automatically', async () => {
    const doc = await parseMarkdown('Before\n\n::page-break\n::\n\nAfter')
    const bytes = await renderPdfFromDocument(doc)
    expect(isPdf(bytes)).toBe(true)
  })
})

describe('chrome and visuals', () => {
  it('accepts PDFElement chrome without a host peel', async () => {
    const { Text } = await import('@jasy/pdf')
    const bytes = await renderPdf('# Body', {
      chrome: {
        header: Text('Letterhead'),
        footer: Text('Legal'),
      },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('lets chrome replace string header templates', async () => {
    const { Text } = await import('@jasy/pdf')
    const bytes = await renderPdf('# Body', {
      pdf: { header: 'String header', footer: 'String footer' },
      chrome: {
        header: Text('Letterhead'),
        footer: Text('Legal'),
      },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('maps headings from visuals faces', async () => {
    const bytes = await renderPdf('# Title\n\n## Section\n\nBody', {
      visuals: {
        face: { title: { size: 12 }, section: { size: 9, bold: true } },
        section: { rule: true },
      },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('keeps custom components inside table cells', async () => {
    const { TextField } = await import('@jasy/pdf')
    const { PdfDocument, readAcroForm } = await import('@jasy/pdf/edit')
    const bytes = await renderPdf('| |\n| --- |\n| :field-text{name="lot.id"} |\n', {
      visuals: { table: { keyValue: true } },
      components: {
        'field-text': (element) => {
          const [, attrs] = element
          return TextField({ name: String(attrs.name ?? 'field') })
        },
      },
    })
    expect(isPdf(bytes)).toBe(true)
    const names = (readAcroForm(PdfDocument.load(bytes))?.fields ?? []).map((f: { name: string }) => f.name)
    expect(names).toContain('lot.id')
  })

  it('renders svg nodes', async () => {
    const bytes = await renderPdf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="100%" height="100%"><rect width="10" height="10"/></svg>')
    expect(isPdf(bytes)).toBe(true)
  })
})

describe('binding', () => {
  it('interpolates {{ }} from data', async () => {
    const bytes = await renderPdf('Hello {{ data.name }}', {
      data: { name: 'Ada' },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('renders ::if and #else', async () => {
    const bytes = await renderPdf([
      '::if{:value="data.show"}',
      'Shown',
      '#else',
      'Hidden',
      '::',
    ].join('\n'), {
      data: { show: true },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('repeats ::for items', async () => {
    const bytes = await renderPdf([
      '::for{:each="data.items" item="item"}',
      '{{ props.item.label }}',
      '::',
    ].join('\n'), {
      data: { items: [{ label: 'A' }, { label: 'B' }] },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('includes ::include', async () => {
    const bytes = await renderPdf('::include{:value="data.content"}\n::', {
      data: { content: '## Section\n\nBody' },
      components: { include: Include },
    })
    expect(isPdf(bytes)).toBe(true)
  })

  it('resolves || as a second path, then as a literal', () => {
    const scope = { data: { tradeName: { es: 'Graficoat', en: '' } } }
    expect(interpolateBindings('{{ data.tradeName.en || data.tradeName.es }}', scope)).toBe('Graficoat')
    expect(interpolateBindings('{{ data.missing || N/A }}', scope)).toBe('N/A')
  })
})
