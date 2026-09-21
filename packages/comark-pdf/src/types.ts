import type { PDFElement } from '@jasy/pdf'
import type { ParserOptions } from 'comark'
import type { JasyComponentFn } from './jasy.ts'

export type PdfFace = {
  size?: number
  color?: string
  bold?: boolean
  italic?: boolean
  uppercase?: boolean
  tracking?: number
  lineHeight?: number
  pad?: { top?: number, bottom?: number, left?: number, right?: number }
}

export type PdfVisuals = {
  face?: {
    title?: PdfFace
    section?: PdfFace
    sub?: PdfFace
    detail?: PdfFace
    body?: PdfFace
    tableHeader?: PdfFace
    tableBody?: PdfFace
    link?: PdfFace
    code?: PdfFace
  }
  ink?: {
    rule?: string
    hairline?: string
    panel?: string
    muted?: string
    faint?: string
  }
  space?: {
    section?: number
    block?: number
    tight?: number
  }
  section?: {
    rule?: boolean | { color?: string, thickness?: number }
  }
  table?: {
    cellPad?: { x: number, y: number }
    headerBg?: string
    rule?: string
    keyValue?: boolean | { columns?: [string, string], rules?: boolean }
  }
  quote?: {
    pad?: PdfFace['pad']
    bg?: string
    bar?: string
  }
  image?: 'embed' | 'alt'
}

export type PdfChrome = {
  header?: PDFElement
  footer?: PDFElement
  /** Page overlay. Pass a Positioned element. It is not part of the header band. */
  watermark?: PDFElement
}

export type PdfFontFaces = Uint8Array | string | {
  normal: Uint8Array | string
  bold?: Uint8Array | string
  italic?: Uint8Array | string
  boldItalic?: Uint8Array | string
}

export interface PdfMargin {
  top?: string | number
  right?: string | number
  bottom?: string | number
  left?: string | number
}

export type PdfJustify = 'start' | 'center' | 'end' | 'between' | 'around'
export type PdfAlign = 'start' | 'center' | 'end' | 'stretch'
export type PdfTextAlign = 'left' | 'center' | 'right' | 'justify'
export type PdfOverflowPolicy = 'error' | 'warn' | 'ignore'

export interface PdfEncryptOptions {
  algorithm?: 'aes-256'
  userPassword: string
  ownerPassword?: string
  permissions?: {
    printing?: boolean
    copying?: boolean
    modifying?: boolean
    annotating?: boolean
  }
}

export interface PdfPageConfig {
  format?: string
  width?: string
  height?: string
  orientation?: 'portrait' | 'landscape'
  margin?: string | number | PdfMargin
  gap?: number | string
  justify?: PdfJustify
  align?: PdfAlign

  font?: string | string[]
  fontSize?: number
  color?: string
  lineHeight?: number
  textAlign?: PdfTextAlign
  bold?: boolean
  italic?: boolean

  title?: string
  author?: string
  lang?: string
  accessible?: boolean
  onOverflow?: PdfOverflowPolicy
  encrypt?: PdfEncryptOptions

  /** Compiles to chrome.header unless chrome.header is set. */
  header?: string
  headerLeft?: string
  headerRight?: string
  /** Compiles to chrome.footer unless chrome.footer is set. */
  footer?: string
  footerLeft?: string
  footerRight?: string
}

export interface PdfRendererOptions extends ParserOptions {
  pdf?: PdfPageConfig
  components?: Record<string, JasyComponentFn>
  visuals?: PdfVisuals
  chrome?: PdfChrome
  fonts?: Record<string, PdfFontFaces>
  onMissingGlyphs?: (chars: string[]) => void
  data?: Record<string, unknown>
}
