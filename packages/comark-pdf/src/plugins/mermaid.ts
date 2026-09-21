import type { ElementNode } from 'comark'
import type { JasyComponentFn } from '../jasy.ts'
import { Box, Image, Svg, Text } from '@jasy/pdf'
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
  if (typeof globalThis.document !== 'undefined' && typeof globalThis.CSSStyleSheet !== 'undefined') return true
  if (mermaidDomReady) return typeof globalThis.document !== 'undefined'
  mermaidDomReady = true
  try {
    const { Window } = await import('happy-dom')
    const win = new Window({ url: 'http://localhost/', width: 1024, height: 768 })
    const g = globalThis as unknown as Record<string, unknown>
    const host = win as unknown as Record<string, unknown>
    const assign = (key: string, value: unknown) => {
      if (g[key] == null && value != null) g[key] = value
    }
    assign('window', win)
    assign('document', win.document)
    for (const key of ['HTMLElement', 'SVGElement', 'Element', 'Node', 'DOMParser', 'XMLSerializer', 'navigator', 'CSSStyleSheet', 'MutationObserver', 'btoa']) {
      assign(key, host[key])
    }
    if (typeof g.getComputedStyle !== 'function') g.getComputedStyle = win.getComputedStyle.bind(win)
    if (typeof g.requestAnimationFrame !== 'function') g.requestAnimationFrame = win.requestAnimationFrame.bind(win)
    return typeof globalThis.document !== 'undefined'
  }
  catch {
    return false
  }
}

const svgBox = (svg: string): { width: number, height: number } | null => {
  const box = /viewBox="[-\d.eE+]+ [-\d.eE+]+ ([-\d.eE+]+) ([-\d.eE+]+)"/.exec(svg)
  if (!box?.[1] || !box[2]) return null
  return { width: Number(box[1]), height: Number(box[2]) }
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
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      ...(theme ? { theme: theme as 'default' } : {}),
    })
    const id = `comark-pdf-mmd-${Math.random().toString(36).slice(2, 10)}`
    const { svg } = await mermaid.render(id, source)
    if (!svg?.includes('<svg')) return null
    const box = svgBox(svg)
    if (!box || box.width < 32 || box.height < 32) return null
    return svg
  }
  catch {
    return null
  }
}

const markerPoints = (edge: Element): Array<{ x: number, y: number }> => {
  const raw = edge.getAttribute('data-points')
  if (raw) {
    try {
      const points = JSON.parse(atob(raw)) as Array<{ x: number, y: number }>
      if (Array.isArray(points) && points.length >= 2) return points
    }
    catch {
      // The path data below is the fallback.
    }
  }
  const nums = [...(edge.getAttribute('d') ?? '').matchAll(/-?\d*\.?\d+/g)].map(match => Number(match[0]))
  const points: Array<{ x: number, y: number }> = []
  for (let index = 0; index + 1 < nums.length; index += 2) {
    const x = nums[index]
    const y = nums[index + 1]
    if (x !== undefined && y !== undefined) points.push({ x, y })
  }
  return points
}

// jasy rejects marker and text. An SVG image also drops marker paint, and Mermaid
// leaves a dash array that hides the stroke. Draw the arrow as a normal path.
const paintSvgMarkers = (svg: string): string => {
  if (typeof DOMParser === 'undefined') return svg
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  for (const edge of Array.from(doc.querySelectorAll('[marker-end],[marker-start]'))) {
    const style = (edge.getAttribute('style') ?? '')
      .replace(/stroke-dasharray\s*:[^;]*;?/g, '')
      .replace(/stroke-dashoffset\s*:[^;]*;?/g, '')
    if (style.trim()) edge.setAttribute('style', style)
    else edge.removeAttribute('style')
    for (const name of ['marker-end', 'marker-start'] as const) {
      const id = /url\(#([^)]+)\)/.exec(edge.getAttribute(name) ?? '')?.[1]
      edge.removeAttribute(name)
      if (!id) continue
      const marker = doc.getElementById(id)
      const points = markerPoints(edge)
      if (!marker || points.length < 2) continue
      const tip = name === 'marker-end' ? points[points.length - 1] : points[0]
      const from = name === 'marker-end' ? points[points.length - 2] : points[1]
      if (!tip || !from) continue
      const angle = Math.atan2(tip.y - from.y, tip.x - from.x) * 180 / Math.PI
      const refX = Number(marker.getAttribute('refX') ?? 0)
      const refY = Number(marker.getAttribute('refY') ?? 0)
      const [, , vbW = 1, vbH = 1] = (marker.getAttribute('viewBox') ?? '0 0 1 1').split(/[\s,]+/).map(Number)
      const scaleX = Number(marker.getAttribute('markerWidth') ?? vbW) / (vbW || 1)
      const scaleY = Number(marker.getAttribute('markerHeight') ?? vbH) / (vbH || 1)
      const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('transform', `translate(${tip.x} ${tip.y}) rotate(${angle}) translate(${-refX * scaleX} ${-refY * scaleY}) scale(${scaleX} ${scaleY})`)
      for (const child of Array.from(marker.children)) {
        const copy = child.cloneNode(true) as Element
        if (!copy.getAttribute('fill')) copy.setAttribute('fill', '#000000')
        group.appendChild(copy)
      }
      edge.parentNode?.appendChild(group)
    }
  }
  return new XMLSerializer().serializeToString(doc.documentElement)
}

const rasterizeSvg = async (svg: string): Promise<Uint8Array | null> => {
  const document = globalThis.document
  const box = svgBox(svg)
  if (!document || typeof document.createElement !== 'function' || !box) return null
  const painted = paintSvgMarkers(svg)
  const sized = painted.replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
    const cleaned = attrs.replace(/\s(?:width|height)="[^"]*"/g, '')
    return `<svg${cleaned} width="${Math.ceil(box.width)}" height="${Math.ceil(box.height)}">`
  })
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new globalThis.Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('svg'))
      img.src = url
    })
    const scale = 2
    const width = Math.max(1, Math.ceil((img.naturalWidth || box.width) * scale))
    const height = Math.max(1, Math.ceil((img.naturalHeight || box.height) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(img, 0, 0, width, height)
    const payload = canvas.toDataURL('image/png').split(',')[1]
    if (!payload) return null
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    return bytes.length > 32 ? bytes : null
  }
  catch {
    return null
  }
  finally {
    URL.revokeObjectURL(url)
  }
}

export const Mermaid: JasyComponentFn = async ([, attrs]: ElementNode) => {
  const content = String(attrs.content ?? '')
  const theme = attrs.theme != null ? String(attrs.theme) : undefined
  const svg = await mermaidToSvg(content, theme)
  if (svg) {
    try {
      return Svg(sanitizeSvgLengths(svg), { height: 180 })
    }
    catch {
      const png = await rasterizeSvg(svg)
      if (png) return Image(png, { height: 140, fit: 'contain' })
    }
  }
  return sourceBox(content)
}
