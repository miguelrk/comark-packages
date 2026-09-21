import { createMarkdownParser } from 'comark'
import binding from 'comark/plugins/binding'
import { pdfBindingComponents } from './binding.ts'
import { PageBreak } from './plugins/page-break.ts'
import { renderPdfBytes } from './render.ts'
import type { PdfRendererOptions } from './types.ts'

export { renderPdfDocument, renderPdfBytes, renderPdfFromDocument } from './render.ts'
export { pdfBindingComponents, Include } from './binding.ts'
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
  resolvePageChrome,
  resolveJasyMargin,
  resolveJasySize,
  resolveJasyCustomSize,
  parseLengthToPt,
} from './page.ts'

const mergePdfOptions = (options?: PdfRendererOptions): PdfRendererOptions => ({
  ...options,
  plugins: [binding(), ...(options?.plugins ?? [])],
  components: { ...pdfBindingComponents, 'page-break': PageBreak, ...options?.components },
})

export const createPdfRenderer = (options?: PdfRendererOptions): ((markdown: string) => Promise<Uint8Array>) => {
  const merged = mergePdfOptions(options)
  const parseMarkdown = createMarkdownParser(merged)
  return async (markdown: string) => {
    const document = await parseMarkdown(markdown)
    return renderPdfBytes(document, merged)
  }
}

export const renderPdf = (markdown: string, options?: PdfRendererOptions): Promise<Uint8Array> =>
  createPdfRenderer(options)(markdown)
