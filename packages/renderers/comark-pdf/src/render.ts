import { Document, Page, Column, renderToBytes } from '@jasy/pdf'
import type { JasyDocument, PageOptions, RenderOptions } from '@jasy/pdf'
import type { MarkdownDocument } from 'comark'
import { astToJasy } from './jasy.ts'
import {
  pdfConfigToDocumentOptions,
  pdfConfigToPageProps,
  pdfConfigToRenderOptions,
  resolveContentGap,
} from './page.ts'
import type { PdfPageConfig, PdfRendererOptions } from './types.ts'

const resolvePdfConfig = (
  document: MarkdownDocument | { nodes: MarkdownDocument['nodes'] },
  options?: PdfRendererOptions,
): PdfPageConfig => {
  const frontmatterPdf = ((document as MarkdownDocument).frontmatter?.pdf ?? {}) as PdfPageConfig
  return { ...frontmatterPdf, ...options?.pdf }
}

export const renderPdfDocument = (
  document: MarkdownDocument | { nodes: MarkdownDocument['nodes'] },
  options?: PdfRendererOptions,
): JasyDocument => {
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

  const nodes = astToJasy(document.nodes, options?.components, textDefaults)
  const content = nodes.length > 0 ? nodes : []
  const page = Page(pageProps as PageOptions, [Column({ gap }, content)])

  return documentOpts ? Document(documentOpts, [page]) : Document([page])
}

export const renderPdfBytes = (
  document: MarkdownDocument | { nodes: MarkdownDocument['nodes'] },
  options?: PdfRendererOptions,
): Promise<Uint8Array> => {
  const pdfConfig = resolvePdfConfig(document, options)
  const renderOpts = pdfConfigToRenderOptions(pdfConfig, options?.fonts) as RenderOptions | undefined
  return renderToBytes(renderPdfDocument(document, options), renderOpts)
}

/** Alias for `renderPdfBytes` — kept for compatibility. */
export const renderPdfFromDocument = renderPdfBytes
