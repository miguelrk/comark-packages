import type { ParserOptions } from 'comark'
import type { JasyComponentFn } from './jasy.ts'

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

  header?: string
  headerLeft?: string
  headerRight?: string
  footer?: string
  footerLeft?: string
  footerRight?: string
}

export interface PdfRendererOptions extends ParserOptions {
  pdf?: PdfPageConfig
  components?: Record<string, JasyComponentFn>
  fonts?: Record<string, Uint8Array | {
    normal: Uint8Array
    bold?: Uint8Array
    italic?: Uint8Array
    boldItalic?: Uint8Array
  }>
}
