import type { ElementNode } from 'comark'
import type { JasyComponentFn } from '../jasy.ts'
import { Box, Svg, Text } from '@jasy/pdf'
import { sanitizeSvgLengths } from '../jasy.ts'

export * from 'comark/plugins/mermaid'
export { default } from 'comark/plugins/mermaid'

const sourceBox = (content: string) =>
  Box(
    { bg: '#f6f8fa', padding: 10, radius: 4 },
    [Text(content, { font: 'Courier', size: 10 })],
  )

let mermaidDomReady = false

const ensureMermaidDom = async (): Promise<boolean> => {
  if (typeof globalThis.document !== 'undefined') return true
  if (mermaidDomReady) return typeof globalThis.document !== 'undefined'
  mermaidDomReady = true
  try {
    const { Window } = await import('happy-dom')
    const win = new Window()
    const g = globalThis as unknown as { window?: unknown, document?: unknown }
    if (!g.window) g.window = win
    if (!g.document) g.document = win.document
    return typeof (globalThis as unknown as { document?: unknown }).document !== 'undefined'
  }
  catch {
    return false
  }
}

const mermaidToSvg = async (source: string, theme?: string): Promise<string | null> => {
  if (!source.trim()) return null
  try {
    const ready = await ensureMermaidDom()
    if (!ready) return null
    const mod = await import('mermaid')
    const mermaid = mod.default
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      ...(theme ? { theme: theme as 'default' } : {}),
    })
    const id = `comark-pdf-mmd-${Math.random().toString(36).slice(2, 10)}`
    const { svg } = await mermaid.render(id, source)
    return svg || null
  }
  catch {
    return null
  }
}

export const Mermaid: JasyComponentFn = async ([, attrs]: ElementNode) => {
  const content = String(attrs.content ?? '')
  const theme = attrs.theme != null ? String(attrs.theme) : undefined
  const svg = await mermaidToSvg(content, theme)
  if (svg) return Svg(sanitizeSvgLengths(svg))
  return sourceBox(content)
}
