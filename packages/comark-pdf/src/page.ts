import { PageBuilder, Row, Text } from '@jasy/pdf'
import type { PDFElement } from '@jasy/pdf'
import type { PdfChrome, PdfMargin, PdfPageConfig, PdfRendererOptions } from './types.ts'

/** Convert a CSS length string or bare points number to PDF points (1 pt = 1/72 in). */
export const parseLengthToPt = (val: string | number): number => {
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) throw new RangeError(`Invalid length: ${val}`)
    return val
  }
  const n = parseFloat(val)
  if (!Number.isFinite(n)) throw new RangeError(`Invalid length string: "${val}"`)
  if (val.endsWith('mm')) return n * (72 / 25.4)
  if (val.endsWith('cm')) return n * (720 / 25.4)
  if (val.endsWith('in')) return n * 72
  if (val.endsWith('px')) return n * 0.75
  if (val.endsWith('pt') || /^\d+(\.\d+)?$/.test(val.trim())) return n
  throw new RangeError(`Unknown length unit in: "${val}"`)
}

export const resolveJasyMargin = (
  margin: string | number | PdfMargin,
): number | { top?: number; right?: number; bottom?: number; left?: number } => {
  if (typeof margin === 'string' || typeof margin === 'number') return parseLengthToPt(margin)
  return {
    top: margin.top !== undefined ? parseLengthToPt(margin.top) : undefined,
    right: margin.right !== undefined ? parseLengthToPt(margin.right) : undefined,
    bottom: margin.bottom !== undefined ? parseLengthToPt(margin.bottom) : undefined,
    left: margin.left !== undefined ? parseLengthToPt(margin.left) : undefined,
  }
}

export type JasySize = string | { width: number; height: number; unit?: 'pt' | 'mm' }

export const resolveJasySize = (format: string, _orientation?: 'portrait' | 'landscape'): string => {
  const map: Record<string, string> = {
    A0: 'A0', A1: 'A1', A2: 'A2', A3: 'A3', A4: 'A4', A5: 'A5', A6: 'A6',
    letter: 'letter', Letter: 'letter',
    legal: 'legal', Legal: 'legal',
    tabloid: 'tabloid', Tabloid: 'tabloid',
  }
  return map[format] ?? format
}

export const resolveJasyCustomSize = (width: string, height: string): JasySize => ({
  width: parseLengthToPt(width),
  height: parseLengthToPt(height),
  unit: 'pt',
})

const fillPageTemplate = (
  template: string,
  pageNumber: number,
  pageCount: number,
) => template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, token: string) => {
  if (token === 'page') return String(pageNumber)
  if (token === 'totalPages') return String(pageCount)
  return `{{ ${token} }}`
})

const buildPageTemplate = (template: string, style: Record<string, unknown> = {}): PDFElement[] => {
  if (!/\{\{\s*(?:page|totalPages)\s*\}\}/.test(template)) {
    return [Text(template, { size: 9, ...style }) as PDFElement]
  }
  return [PageBuilder(({ pageNumber, pageCount }) =>
    Text(fillPageTemplate(template, pageNumber, pageCount), { size: 9, ...style }),
  ) as PDFElement]
}

const buildHeader = (pdf: PdfPageConfig): PDFElement | undefined => {
  const { header, headerLeft, headerRight } = pdf
  if (!header && !headerLeft && !headerRight) return undefined

  const left = headerLeft ? buildPageTemplate(headerLeft) : [Text('') as PDFElement]
  const center = header ? buildPageTemplate(header) : []
  const right = headerRight ? buildPageTemplate(headerRight) : [Text('') as PDFElement]

  if (header && !headerLeft && !headerRight) {
    return Row({ justify: 'center' }, buildPageTemplate(header)) as PDFElement
  }

  return Row({ justify: 'between' }, [
    Row({}, left) as PDFElement,
    ...(center.length > 0 ? [Row({}, center) as PDFElement] : []),
    Row({}, right) as PDFElement,
  ]) as PDFElement
}

const buildFooter = (pdf: PdfPageConfig): PDFElement | undefined => {
  const { footer, footerLeft, footerRight } = pdf
  if (!footer && !footerLeft && !footerRight) return undefined

  const left = footerLeft ? buildPageTemplate(footerLeft) : [Text('') as PDFElement]
  const center = footer ? buildPageTemplate(footer) : []
  const right = footerRight ? buildPageTemplate(footerRight) : [Text('') as PDFElement]

  if (footer && !footerLeft && !footerRight) {
    return Row({ justify: 'center' }, buildPageTemplate(footer)) as PDFElement
  }

  return Row({ justify: 'between' }, [
    Row({}, left) as PDFElement,
    ...(center.length > 0 ? [Row({}, center) as PDFElement] : []),
    Row({}, right) as PDFElement,
  ]) as PDFElement
}

export interface JasyPageProps {
  size: JasySize
  orientation?: 'portrait' | 'landscape'
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number }
  justify?: PdfPageConfig['justify']
  align?: PdfPageConfig['align']
}

export type PageChrome = {
  header?: PDFElement
  footer?: PDFElement
  watermark?: PDFElement
}

/** One chrome slot: host elements replace compiled string templates. */
export const resolvePageChrome = (
  pdf: PdfPageConfig = {},
  chrome?: PdfChrome,
): PageChrome => ({
  header: chrome?.header ?? buildHeader(pdf),
  footer: chrome?.footer ?? buildFooter(pdf),
  watermark: chrome?.watermark,
})

export interface JasyDocumentOptions {
  font?: string | string[]
  size?: number
  color?: string
  lineHeight?: number
  align?: PdfPageConfig['textAlign']
  bold?: boolean
  italic?: boolean
  meta?: { title?: string; author?: string }
}

export interface JasyRenderOptions {
  title?: string
  lang?: string
  accessible?: boolean
  onOverflow?: PdfPageConfig['onOverflow']
  encrypt?: PdfPageConfig['encrypt']
  fonts?: PdfRendererOptions['fonts']
}

const hasDocumentOptions = (pdf: PdfPageConfig): boolean =>
  pdf.font !== undefined
  || pdf.fontSize !== undefined
  || pdf.color !== undefined
  || pdf.lineHeight !== undefined
  || pdf.textAlign !== undefined
  || pdf.bold !== undefined
  || pdf.italic !== undefined
  || pdf.title !== undefined
  || pdf.author !== undefined

export const pdfConfigToPageProps = (pdf: PdfPageConfig = {}): JasyPageProps => {
  const { format = 'A4', width, height, orientation, margin, justify, align } = pdf
  const size =
    width && height
      ? resolveJasyCustomSize(width, height)
      : resolveJasySize(format, orientation)
  return {
    size,
    orientation,
    // Default margin 20mm when none is specified (as documented)
    margin: margin !== undefined ? resolveJasyMargin(margin) : parseLengthToPt('20mm'),
    justify,
    align,
  }
}

export const pdfConfigToDocumentOptions = (pdf: PdfPageConfig = {}): JasyDocumentOptions | undefined => {
  if (!hasDocumentOptions(pdf)) return undefined

  const meta =
    pdf.title !== undefined || pdf.author !== undefined
      ? { title: pdf.title, author: pdf.author }
      : undefined

  return {
    font: pdf.font,
    size: pdf.fontSize,
    color: pdf.color,
    lineHeight: pdf.lineHeight,
    align: pdf.textAlign,
    bold: pdf.bold,
    italic: pdf.italic,
    meta,
  }
}

export const pdfConfigToRenderOptions = (
  pdf: PdfPageConfig = {},
  fonts?: JasyRenderOptions['fonts'],
): JasyRenderOptions | undefined => {
  const hasRender =
    pdf.title !== undefined
    || pdf.lang !== undefined
    || pdf.accessible !== undefined
    || pdf.onOverflow !== undefined
    || pdf.encrypt !== undefined
    || fonts !== undefined

  if (!hasRender) return undefined

  return {
    title: pdf.title,
    lang: pdf.lang,
    accessible: pdf.accessible,
    onOverflow: pdf.onOverflow,
    encrypt: pdf.encrypt,
    fonts,
  }
}

export const resolveContentGap = (pdf: PdfPageConfig = {}): number =>
  pdf.gap !== undefined ? parseLengthToPt(pdf.gap) : 10
