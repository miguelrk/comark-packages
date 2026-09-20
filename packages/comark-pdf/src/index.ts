import { createMarkdownParser } from 'comark'
import { PageBreak } from './plugins/page-break.ts'
import { renderPdfBytes } from './render.ts'
import type { PdfRendererOptions } from './types.ts'

export { renderPdfDocument, renderPdfBytes, renderPdfFromDocument } from './render.ts'
export type {
  PdfChrome,
  PdfEncryptOptions,
  PdfFace,
  PdfFontFaces,
  PdfJustify,
  PdfAlign,
  PdfMargin,
  PdfOverflowPolicy,
  PdfPageConfig,
  PdfRendererOptions,
  PdfTextAlign,
  PdfVisuals,
} from './types.ts'
export type { JasyComponentFn, JasyMapContext, JasyTextDefaults } from './jasy.ts'
export {
  pdfConfigToPageProps,
  pdfConfigToDocumentOptions,
  pdfConfigToRenderOptions,
  resolveContentGap,
  resolveJasyMargin,
  resolveJasySize,
  resolveJasyCustomSize,
  parseLengthToPt,
} from './page.ts'

const mergeComponents = (options?: PdfRendererOptions): PdfRendererOptions => ({
  ...options,
  components: { 'page-break': PageBreak, ...options?.components },
})

export const createPdfRenderer = (options?: PdfRendererOptions): ((markdown: string) => Promise<Uint8Array>) => {
  const merged = mergeComponents(options)
  const parseMarkdown = createMarkdownParser(merged)
  return async (markdown: string) => {
    const document = await parseMarkdown(markdown)
    return renderPdfBytes(document, merged)
  }
}

export const renderPdf = (markdown: string, options?: PdfRendererOptions): Promise<Uint8Array> =>
  createPdfRenderer(options)(markdown)
