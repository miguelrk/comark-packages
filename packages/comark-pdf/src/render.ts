import { Document, Page, Column, renderToBytes } from '@jasy/pdf'
import type { JasyDocument, PageOptions, PDFElement, RenderOptions } from '@jasy/pdf'
import { createMarkdownParser } from 'comark'
import type { MarkdownDocument } from 'comark'
import binding from 'comark/plugins/binding'
import { pdfBindingComponents } from './binding.ts'
import { astToJasy } from './jasy.ts'
import {
  pdfConfigToDocumentOptions,
  pdfConfigToPageProps,
  pdfConfigToRenderOptions,
  resolveContentGap,
  resolvePageChrome,
} from './page.ts'
import type { PdfPageConfig, PdfRendererOptions } from './types.ts'

const resolvePdfConfig = (
  document: MarkdownDocument | { nodes: MarkdownDocument['nodes'] },
  options?: PdfRendererOptions,
): PdfPageConfig => {
  const frontmatterPdf = ((document as MarkdownDocument).frontmatter?.pdf ?? {}) as PdfPageConfig
  return { ...frontmatterPdf, ...options?.pdf }
}

export const renderPdfDocument = async (
  document: MarkdownDocument | { nodes: MarkdownDocument['nodes'] },
  options?: PdfRendererOptions,
): Promise<JasyDocument> => {
  const pdfConfig = resolvePdfConfig(document, options)
  const pageProps = pdfConfigToPageProps(pdfConfig)
  const documentOpts = pdfConfigToDocumentOptions(pdfConfig)
  const gap = resolveContentGap(pdfConfig)

  const textDefaults = documentOpts
    ? {
        size: documentOpts.size,
        font: documentOpts.font,
        color: typeof documentOpts.color === 'string' ? documentOpts.color : undefined,
        lineHeight: documentOpts.lineHeight,
        align: documentOpts.align,
        bold: documentOpts.bold,
        italic: documentOpts.italic,
      }
    : undefined

  const parseMarkdown = createMarkdownParser({
    ...options,
    plugins: [binding(), ...(options?.plugins ?? [])],
  })
  const nodes = await astToJasy(
    document.nodes,
    { ...pdfBindingComponents, ...options?.components },
    textDefaults,
    options?.visuals,
    {
      data: options?.data,
      frontmatter: (document as MarkdownDocument).frontmatter,
      parseMarkdown,
    },
  )
  const content = nodes.length > 0 ? nodes : []
  const chrome = resolvePageChrome(pdfConfig, options?.chrome)
  const body: PDFElement[] = [Column({ gap }, content)]
  if (chrome.watermark) body.unshift(chrome.watermark)

  const page = Page(
    { ...pageProps, header: chrome.header, footer: chrome.footer } as PageOptions,
    body,
  )

  return documentOpts ? Document(documentOpts, [page]) : Document([page])
}

export const renderPdfBytes = async (
  document: MarkdownDocument | { nodes: MarkdownDocument['nodes'] },
  options?: PdfRendererOptions,
): Promise<Uint8Array> => {
  const pdfConfig = resolvePdfConfig(document, options)
  const renderOpts = {
    ...pdfConfigToRenderOptions(pdfConfig),
    ...(options?.onMissingGlyphs ? { onMissingGlyphs: options.onMissingGlyphs } : {}),
  } as RenderOptions | undefined
  const doc = await renderPdfDocument(document, options)
  if (options?.fonts) {
    for (const [name, faces] of Object.entries(options.fonts)) {
      doc.addFont(name, faces)
    }
  }
  return renderToBytes(doc, renderOpts)
}

/** Alias for `renderPdfBytes` — kept for compatibility. */
export const renderPdfFromDocument = renderPdfBytes
