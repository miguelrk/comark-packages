import { writeFile } from 'node:fs/promises'
import { renderPdf, renderPdfFromDocument } from './index.ts'
import type { PdfRendererOptions } from './types.ts'

export { renderPdfFromDocument }

export const renderPdfToBuffer = (markdown: string, options?: PdfRendererOptions): Promise<Uint8Array> =>
  renderPdf(markdown, options)

export const renderPdfToFile = async (
  markdown: string,
  outputPath: string,
  options?: PdfRendererOptions,
): Promise<void> => {
  const buffer = await renderPdfToBuffer(markdown, options)
  await writeFile(outputPath, buffer)
}
