/**
 * comark-etiket: barcodes and QR codes as components (`::qrcode{value="…"}`).
 */
import type { ComponentDef, PropDef } from '../types.ts'
import { definePlugin } from '../plugins.ts'

const props: Record<string, PropDef> = {
  value: { type: 'string', required: true, description: 'Encoded value (or `:value` data path)' },
  size: { type: 'number' },
  output: { enum: ['svg', 'img', 'png'], default: 'svg' },
  color: { type: 'string' },
  'ec-level': { enum: ['L', 'M', 'Q', 'H'], description: 'QR error correction' },
}

export const ETIKET_TAGS = [
  'qrcode', 'microqr', 'rmqr', 'barcode', 'postal', 'datamatrix', 'gs1datamatrix', 'pdf417', 'micropdf417', 'aztec',
  'maxicode', 'dotcode', 'hanxin', 'codablockf', 'code16k', 'jabcode', 'qr-wifi', 'qr-email', 'qr-sms', 'qr-geo',
  'qr-url', 'qr-phone', 'qr-vcard', 'qr-mecard', 'qr-event', 'swiss-qr', 'gs1-digital-link', 'barcode-sheet', 'qr-sheet',
] as const

export const etiketComponents: ComponentDef[] = ETIKET_TAGS.map(name => ({
  name,
  kind: 'block',
  group: 'Etiket',
  description: name.startsWith('qr') || name.endsWith('qr') ? 'QR code' : 'Barcode',
  props,
  example: `::${name}{value="https://comark.dev"}\n::`,
}))

export default definePlugin(() => ({
  name: 'etiket',
  components: etiketComponents,
  llms: 'Barcodes and QR codes (comark-etiket): `::qrcode{value="https://…"}` … `::`; other symbologies take the same props (`value`, `size`, `color`, `output`).',
}))
