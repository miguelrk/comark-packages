import type { PDFElement } from '@jasy/pdf'
import type { ElementNode, MarkdownDocument, Node } from 'comark'
import type { BindingScope } from './binding.ts'
import type { PdfFace, PdfVisuals } from './types.ts'
import {
  Anchor,
  Bookmark,
  Box,
  Column,
  Divider,
  Image,
  Padding,
  PageBreak,
  Paragraph,
  Row,
  span,
  Svg,
  Table,
  Text,
} from '@jasy/pdf'
import { resolveBindingText, resolveBoundAttrs } from './binding.ts'
import { resolveImageSrc } from './image.ts'

export type JasyComponentResult = PDFElement | PDFElement[] | null

export type JasyComponentFn = (
  element: ElementNode,
  ctx: JasyMapContext,
) => JasyComponentResult | Promise<JasyComponentResult>

export interface JasyTextDefaults {
  size?: number
  font?: string | string[]
  color?: string
  lineHeight?: number
  align?: 'left' | 'center' | 'right' | 'justify'
  bold?: boolean
  italic?: boolean
}

export interface JasyMapContext extends BindingScope {
  mapNodes(nodes: Node[]): Promise<PDFElement[]>
  mapInlineToSpans(nodes: Node[], inheritStyle?: Record<string, unknown>): ReturnType<typeof span>[]
  withScope(props: Record<string, unknown>): JasyMapContext
  resolveAttrs(attrs: Record<string, unknown>): Record<string, unknown>
  components?: Record<string, JasyComponentFn>
  textDefaults?: JasyTextDefaults
  visuals?: PdfVisuals
  parseMarkdown?: (markdown: string) => Promise<Pick<MarkdownDocument, 'nodes'>>
}

const HEADING_SIZES = [28, 22, 18, 16, 14, 13] as const
const DEFAULT_BODY_SIZE = 12

const PRINT_FACE: Record<'title' | 'section' | 'sub' | 'detail' | 'body' | 'tableHeader' | 'tableBody', PdfFace> = {
  title: { size: 14 },
  section: { size: 10, bold: true },
  sub: { size: 9, color: '#71717a' },
  detail: { size: 6.5, color: '#71717a' },
  body: { size: 8 },
  tableHeader: { size: 7, color: '#71717a' },
  tableBody: { size: 8 },
}

const headingRole = (tag: string): 'title' | 'section' | 'sub' | 'detail' => {
  if (tag === 'h1') return 'title'
  if (tag === 'h2') return 'section'
  if (tag === 'h3') return 'sub'
  return 'detail'
}

const resolveFace = (ctx: JasyMapContext, role: keyof typeof PRINT_FACE): PdfFace => ({
  ...PRINT_FACE[role],
  ...ctx.visuals?.face?.[role],
})

const faceStyle = (face: PdfFace, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...(face.size !== undefined ? { size: face.size } : {}),
  ...(face.color !== undefined ? { color: face.color } : {}),
  ...(face.bold !== undefined ? { bold: face.bold } : {}),
  ...(face.italic !== undefined ? { italic: face.italic } : {}),
  ...(face.uppercase ? { textTransform: 'uppercase' } : {}),
  ...(face.tracking !== undefined ? { letterSpacing: face.tracking } : {}),
  ...(face.lineHeight !== undefined ? { lineHeight: face.lineHeight } : {}),
  ...extra,
})

const applyPad = (face: PdfFace, space: PdfVisuals['space'] | undefined, child: PDFElement): PDFElement => {
  const pad = face.pad ?? {}
  const top = pad.top
  const bottom = pad.bottom
  const left = pad.left
  const right = pad.right
  if (top === undefined && bottom === undefined && left === undefined && right === undefined) {
    return space?.tight ? Padding({ bottom: space.tight }, child) : child
  }
  return Padding({ top, bottom, left, right }, child)
}

const childrenOf = (node: Node): Node[] => {
  if (typeof node === 'string') return []
  const [, , ...ch] = node as ElementNode
  return ch as Node[]
}

const nodeToHtml = (node: Node): string => {
  if (typeof node === 'string') return node
  const [tag, attrs, ...children] = node as ElementNode
  if (tag == null) return ''
  const VOID = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'use', 'stop', 'image'])
  const attrStr = Object.entries(attrs)
    .filter(([k]) => k !== '$')
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' ')
  const space = attrStr ? ` ${attrStr}` : ''
  const inner = (children as Node[]).map(nodeToHtml).join('')
  if (VOID.has(tag) && !inner) return `<${tag}${space} />`
  return `<${tag}${space}>${inner}</${tag}>`
}

export const sanitizeSvgLengths = (svg: string): string => {
  const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/)
  const w = vb?.[1] ?? '100'
  const h = vb?.[2] ?? '100'
  return svg
    .replace(/\bwidth="100%"/g, `width="${w}"`)
    .replace(/\bheight="100%"/g, `height="${h}"`)
}

const isEmptyCell = (node: Node): boolean => {
  if (typeof node === 'string') return node.trim() === ''
  return childrenOf(node).every(ch =>
    typeof ch === 'string' ? ch.trim() === '' : childrenOf(ch).length === 0,
  )
}

const bodyTextStyle = (
  ctx: JasyMapContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => {
  const d = ctx.textDefaults
  const face = ctx.visuals ? resolveFace(ctx, 'body') : undefined
  return {
    size: face?.size ?? d?.size ?? DEFAULT_BODY_SIZE,
    ...(d?.font !== undefined ? { font: d.font } : {}),
    ...(face?.color !== undefined ? { color: face.color } : d?.color !== undefined ? { color: d.color } : {}),
    ...(face?.lineHeight !== undefined ? { lineHeight: face.lineHeight } : d?.lineHeight !== undefined ? { lineHeight: d.lineHeight } : {}),
    ...(d?.align !== undefined ? { align: d.align } : {}),
    ...(face?.bold !== undefined ? { bold: face.bold } : d?.bold !== undefined ? { bold: d.bold } : {}),
    ...(face?.italic !== undefined ? { italic: face.italic } : d?.italic !== undefined ? { italic: d.italic } : {}),
    ...extra,
  }
}

const textContent = (nodes: Node[]): string =>
  nodes
    .map((n) => {
      if (typeof n === 'string') return n
      const [, , ...children] = n as ElementNode
      return textContent(children)
    })
    .join('')

const classOf = (attrs: Record<string, unknown>): string =>
  String(attrs.class ?? '')

const isTruthyBinding = (value: unknown): boolean =>
  value === true || value === 'true' || value === ''

const isCheckboxInput = (tag: unknown, attrs: Record<string, unknown>): boolean =>
  tag === 'input' && String(attrs.type ?? '') === 'checkbox'

const findCheckbox = (nodes: Node[]): { checked: boolean } | null => {
  for (const node of nodes) {
    if (typeof node === 'string') continue
    const [tag, attrs, ...children] = node as ElementNode
    if (isCheckboxInput(tag, attrs)) {
      return { checked: isTruthyBinding(attrs[':checked'] ?? attrs.checked) }
    }
    if (tag === 'p' || tag === 'label' || tag === 'li') {
      const inner = findCheckbox(children as Node[])
      if (inner) return inner
    }
  }
  return null
}

const stripCheckbox = (nodes: Node[]): Node[] => {
  const out: Node[] = []
  for (const node of nodes) {
    if (typeof node === 'string') {
      out.push(node)
      continue
    }
    const [tag, attrs, ...children] = node as ElementNode
    if (isCheckboxInput(tag, attrs)) continue
    if (tag === 'p' || tag === 'label') {
      out.push([tag, attrs, ...stripCheckbox(children as Node[])] as ElementNode)
      continue
    }
    out.push(node)
  }
  return out
}

const hasEmbeddableImg = (nodes: Node[], ctx: JasyMapContext): boolean => {
  if (ctx.visuals?.image !== 'embed') return false
  return nodes.some((node) => {
    if (typeof node === 'string') return false
    const [tag, attrs, ...children] = node as ElementNode
    if (tag === 'img' && String(attrs.src ?? '').trim()) return true
    return hasEmbeddableImg(children as Node[], ctx)
  })
}

const cssDecl = (style: unknown, property: string): string | undefined => {
  if (typeof style !== 'string') return undefined
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i').exec(style)
  const value = match?.[1]?.trim()
  return value || undefined
}

const mapCodeSpans = (
  nodes: Node[],
  inherit: Record<string, unknown> = {},
): ReturnType<typeof span>[] => {
  const result: ReturnType<typeof span>[] = []
  for (const node of nodes) {
    if (typeof node === 'string') {
      if (node) result.push(span(node, inherit))
      continue
    }
    const [tag, attrs, ...children] = node as ElementNode
    const color = cssDecl(attrs.style, 'color')
    const next = color && !color.includes('--shiki-dark') ? { ...inherit, color } : inherit
    if (tag === 'code' || tag === 'span') {
      result.push(...mapCodeSpans(children as Node[], next))
      continue
    }
    result.push(...mapCodeSpans(children as Node[], inherit))
  }
  return result
}

const slugHeading = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'heading'

const altImageText = (alt: string) =>
  Text(alt ? `[Image: ${alt}]` : '[Image]', { italic: true, color: '#666666', size: 11 }) as PDFElement

const embedImage = async (
  attrs: Record<string, unknown>,
  ctx: JasyMapContext,
): Promise<PDFElement | null> => {
  const alt = String(attrs.alt ?? '')
  if (ctx.visuals?.image !== 'embed') return altImageText(alt)
  const src = String(attrs.src ?? '')
  if (!src) return altImageText(alt)
  const resolved = await resolveImageSrc(src)
  if (resolved.kind === 'fallback') return altImageText(alt)
  const w = attrs.width ? Number(attrs.width) : undefined
  const h = attrs.height ? Number(attrs.height) : undefined
  return Image(resolved.kind === 'bytes' ? resolved.bytes : resolved.path, {
    ...(w ? { width: w } : {}),
    ...(h ? { height: h } : {}),
    ...(alt ? { alt } : {}),
  }) as PDFElement
}

const wrapHeading = (
  heading: PDFElement,
  tag: string,
  attrs: Record<string, unknown>,
  children: Node[],
): PDFElement => {
  const title = textContent(children).trim() || tag
  const level = Number.parseInt(String(tag).charAt(1), 10) || 1
  const name = String(attrs.id ?? `h${level}-${slugHeading(title)}`)
  return Bookmark({ title, level }, Anchor({ name }, heading)) as PDFElement
}

const mapInlineToSpans = (
  nodes: Node[],
  inheritStyle: Record<string, unknown> = {},
  ctx: JasyMapContext,
): ReturnType<typeof span>[] => {
  const result: ReturnType<typeof span>[] = []

  for (const node of nodes) {
    if (typeof node === 'string') {
      if (node) result.push(span(node, inheritStyle))
      continue
    }

    const [tag, rawAttrs, ...children] = node as ElementNode
    const attrs = resolveBoundAttrs(rawAttrs, ctx)
    const style = { ...inheritStyle }

    switch (tag) {
      case 'strong':
        style.bold = true
        break
      case 'em':
        style.italic = true
        break
      case 'code':
        style.font = 'Courier'
        break
      case 'a':
        style.href = String(attrs.href ?? '')
        style.color = '#1450aa'
        style.underline = true
        break
      case 'br':
        result.push(span('\n', inheritStyle))
        continue
      case 's':
      case 'del':
        style.strikethrough = true
        break
      case 'sup':
        style.verticalAlign = 'super'
        style.size = typeof inheritStyle.size === 'number' ? inheritStyle.size * 0.75 : 9
        break
      case 'sub':
        style.verticalAlign = 'sub'
        style.size = typeof inheritStyle.size === 'number' ? inheritStyle.size * 0.75 : 9
        break
      case 'img': {
        if (ctx.visuals?.image === 'embed') continue
        const alt = String(attrs.alt ?? '')
        if (alt) result.push(span(`[${alt}]`, { ...inheritStyle, italic: true, color: '#666666' }))
        continue
      }
      case 'input':
        continue
      default: {
        if (tag === 'binding') {
          const text = resolveBindingText(rawAttrs, ctx)
          if (text) result.push(span(text, style))
          continue
        }
        if (ctx.components?.[tag as string]) {
          const text = textContent(children)
          if (text) result.push(span(text, style))
          continue
        }
        break
      }
    }

    if (children.length > 0) {
      result.push(...mapInlineToSpans(children, style, ctx))
    }
  }

  return result
}

const inlineContent = (
  children: Node[],
  ctx: JasyMapContext,
): string | ReturnType<typeof span>[] => {
  const size = ctx.visuals ? resolveFace(ctx, 'body').size : ctx.textDefaults?.size ?? DEFAULT_BODY_SIZE
  const spans = mapInlineToSpans(children, { size }, ctx)
  if (spans.length === 0) return ''
  if (spans.length === 1 && Object.keys(spans[0] as object).length <= 1) {
    return (spans[0] as { text?: string }).text ?? ''
  }
  return spans
}

const mapListItem = async (
  children: Node[],
  ctx: JasyMapContext,
): Promise<PDFElement[]> => {
  if (children.length === 1) {
    const child = children[0]
    if (Array.isArray(child) && (child as ElementNode)[0] === 'p') {
      const [, , ...pChildren] = child as ElementNode
      if (hasEmbeddableImg(pChildren, ctx) || cellHasComponent(pChildren, ctx)) {
        return ctx.mapNodes(unwrapCellNodes(pChildren))
      }
      const content = inlineContent(pChildren, ctx)
      return [Text(content, bodyTextStyle(ctx)) as PDFElement]
    }
  }
  return ctx.mapNodes(children)
}

const cellHasComponent = (nodes: Node[], ctx: JasyMapContext): boolean =>
  nodes.some((node) => {
    if (typeof node === 'string') return false
    const [tag, , ...children] = node as ElementNode
    if (tag && ctx.components?.[String(tag)]) return true
    return cellHasComponent(children as Node[], ctx)
  })

const unwrapCellNodes = (nodes: Node[]): Node[] => {
  const out: Node[] = []
  for (const node of nodes) {
    if (typeof node === 'string') {
      if (node.trim()) out.push(node)
      continue
    }
    const [tag, , ...children] = node as ElementNode
    if (tag === 'p' || tag === 'div') {
      out.push(...unwrapCellNodes(children as Node[]))
      continue
    }
    out.push(node)
  }
  return out
}

const mapTableCell = async (
  cell: Node,
  ctx: JasyMapContext,
  role: 'header' | 'body',
): Promise<PDFElement> => {
  const face = ctx.visuals
    ? resolveFace(ctx, role === 'header' ? 'tableHeader' : 'tableBody')
    : undefined
  const style = (extra: Record<string, unknown> = {}) =>
    face ? faceStyle(face, extra) : bodyTextStyle(ctx, extra)
  const pad = ctx.visuals?.table?.cellPad
  const headerBg = role === 'header' ? ctx.visuals?.table?.headerBg : undefined

  if (typeof cell === 'string') {
    return wrapTableCell(Text(cell, style()) as PDFElement, pad, headerBg)
  }
  if (!Array.isArray(cell)) return wrapTableCell(Text('', style()) as PDFElement, pad, headerBg)

  const [tag, attrs, ...children] = cell as ElementNode
  if (!['th', 'td'].includes(String(tag))) {
    return wrapTableCell(Text('', style()) as PDFElement, pad, headerBg)
  }
  const align = String(attrs.align ?? 'left') as 'left' | 'center' | 'right'
  if (cellHasComponent(children as Node[], ctx) || hasEmbeddableImg(children as Node[], ctx)) {
    const mapped = await ctx.mapNodes(unwrapCellNodes(children as Node[]))
    const inner = mapped.length === 0
      ? Text('', style({ align })) as PDFElement
      : mapped.length === 1
        ? mapped[0]!
        : Column({ gap: 2 }, mapped) as PDFElement
    return wrapTableCell(inner, pad, headerBg)
  }
  const content = inlineContent(children as Node[], ctx)
  return wrapTableCell(Text(content as string, style({ align })) as PDFElement, pad, headerBg)
}

const mapTableRow = async (
  node: ElementNode,
  ctx: JasyMapContext,
  role: 'header' | 'body' = 'body',
): Promise<PDFElement[]> => {
  const cells = childrenOf(node)
    .filter(c => typeof c === 'string' || (Array.isArray(c) && ['th', 'td'].includes(String((c as ElementNode)[0]))))
  return Promise.all(cells.map(cell => mapTableCell(cell, ctx, role)))
}

const wrapTableCell = (
  text: PDFElement,
  pad: { x: number, y: number } | undefined,
  headerBg: string | undefined,
): PDFElement => {
  if (headerBg) {
    return Box({ bg: headerBg, padding: pad, width: '100%' }, [text]) as PDFElement
  }
  return pad ? Padding(pad, text) as PDFElement : text
}

const mapBlockNode = async (node: Node, ctx: JasyMapContext): Promise<PDFElement | PDFElement[] | null> => {
  if (typeof node === 'string') {
    const text = node.trim()
    return text ? Text(text, bodyTextStyle(ctx)) as PDFElement : null
  }

  const [tag, rawAttrs, ...children] = node as ElementNode
  const attrs = resolveBoundAttrs(rawAttrs, ctx)

  if (tag === null) return null

  const componentFn = ctx.components?.[tag as string]
  if (componentFn) {
    return componentFn([tag, attrs, ...children] as ElementNode, ctx)
  }

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const content = inlineContent(children, ctx)
      if (ctx.visuals) {
        const role = headingRole(String(tag))
        const face = resolveFace(ctx, role)
        const heading = Text(content as string, faceStyle(face, {
          ...(ctx.textDefaults?.font !== undefined ? { font: ctx.textDefaults.font } : {}),
        })) as PDFElement
        const rule = ctx.visuals.section?.rule
        const withRule = role === 'section' && rule
          ? Column({ gap: 2 }, [
              heading,
              Divider({
                color: typeof rule === 'object' ? (rule.color ?? ctx.visuals.ink?.rule ?? '#d4d4d8') : (ctx.visuals.ink?.rule ?? '#d4d4d8'),
                thickness: typeof rule === 'object' ? (rule.thickness ?? 0.5) : 0.5,
                margin: { y: 0 },
              }),
            ]) as PDFElement
          : heading
        return wrapHeading(applyPad(face, ctx.visuals.space, withRule), String(tag), attrs, children)
      }
      const level = parseInt(String(tag).charAt(1)) - 1
      const heading = Text(content as string, {
        size: HEADING_SIZES[level] ?? 12,
        bold: level < 2,
        ...(ctx.textDefaults?.font !== undefined ? { font: ctx.textDefaults.font } : {}),
        ...(ctx.textDefaults?.color !== undefined ? { color: ctx.textDefaults.color } : {}),
      }) as PDFElement
      return wrapHeading(heading, String(tag), attrs, children)
    }

    case 'p': {
      if (cellHasComponent(children, ctx) || hasEmbeddableImg(children, ctx)) {
        const mapped = await ctx.mapNodes(unwrapCellNodes(children))
        if (mapped.length === 0) return null
        return (mapped.length === 1 ? mapped[0] : Column({ gap: 2 }, mapped)) as PDFElement
      }
      const content = inlineContent(children, ctx)
      if (!content || (typeof content === 'string' && !content.trim())) return null
      return Paragraph(content as string, bodyTextStyle(ctx)) as PDFElement
    }

    case 'blockquote': {
      const inner = await ctx.mapNodes(children)
      if (ctx.visuals) {
        return Box(
          {
            bg: ctx.visuals.quote?.bg ?? ctx.visuals.ink?.panel ?? '#f4f4f5',
            ...(ctx.visuals.quote?.bar ? { borderLeft: ctx.visuals.quote.bar, borderWidth: 3 } : {}),
            padding: ctx.visuals.quote?.pad ?? { left: 8 },
          },
          inner.length > 0 ? inner : [Text('') as PDFElement],
        ) as PDFElement
      }
      return Box(
        { borderLeft: '#aaaaaa', borderWidth: 3, padding: { left: 12, top: 4, bottom: 4 } },
        inner.length > 0 ? inner : [Text('') as PDFElement],
      ) as PDFElement
    }

    case 'pre': {
      const bg = cssDecl(attrs.style, 'background-color') ?? cssDecl(attrs.style, 'background') ?? '#f6f8fa'
      const runs = mapCodeSpans(children, { font: 'Courier', size: 10 })
      const code = runs.length > 0 ? runs : textContent(children).trimEnd()
      return Box(
        { bg, padding: 12, radius: 4 },
        [Text(code, { font: 'Courier', size: 10 }) as PDFElement],
      ) as PDFElement
    }

    case 'hr':
      return Divider({
        color: ctx.visuals?.ink?.rule ?? '#cccccc',
        margin: { y: ctx.visuals?.space?.tight ?? 8 },
      }) as PDFElement

    case 'ul':
    case 'ol': {
      const items = await Promise.all(children.map(async (child, i) => {
        if (typeof child === 'string') return null
        const [itemTag, itemAttrs, ...itemChildren] = child as ElementNode
        if (itemTag !== 'li') return null
        const checkbox = classOf(itemAttrs).includes('task-list-item')
          ? findCheckbox(itemChildren) ?? { checked: false }
          : findCheckbox(itemChildren)
        const body = checkbox ? stripCheckbox(itemChildren) : itemChildren
        const inner = await mapListItem(body, ctx)
        const marker = checkbox
          ? Text(checkbox.checked ? '[x]' : '[ ]', bodyTextStyle(ctx, { font: 'Courier', color: '#666666' }))
          : Text(tag === 'ol' ? `${i + 1}.` : '•', bodyTextStyle(ctx, { color: '#666666' }))
        return Row({ gap: 6, align: 'start' }, [
          marker as PDFElement,
          Column({ gap: 4 }, inner.length > 0 ? inner : [Text('') as PDFElement]) as PDFElement,
        ]) as PDFElement
      }))
      const filteredItems = items.filter((x): x is PDFElement => x !== null)
      return Column({ gap: 6 }, filteredItems.length > 0 ? filteredItems : [Text('') as PDFElement]) as PDFElement
    }

    case 'li': {
      const inner = await mapListItem(children, ctx)
      return Column({ gap: 4 }, inner.length > 0 ? inner : [Text('') as PDFElement]) as PDFElement
    }

    case 'table': {
      const thead = children.find(
        (c) => Array.isArray(c) && (c as ElementNode)[0] === 'thead',
      ) as ElementNode | undefined
      const tbody = children.find(
        (c) => Array.isArray(c) && (c as ElementNode)[0] === 'tbody',
      ) as ElementNode | undefined

      const headerRowNode = thead ? (thead[2] as ElementNode | undefined) : undefined
      const headerCellNodes = headerRowNode
        ? childrenOf(headerRowNode).filter(c => Array.isArray(c) && ['th', 'td'].includes((c as ElementNode)[0]))
        : []
      const bodyRowNodes = tbody
        ? (tbody as ElementNode).slice(2).filter(Array.isArray) as ElementNode[]
        : []

      const numCols = Math.max(
        headerCellNodes.length,
        bodyRowNodes[0] ? childrenOf(bodyRowNodes[0]).length : 1,
        1,
      )
      const keyValueOn = ctx.visuals?.table?.keyValue !== false
      const isKeyValue = Boolean(ctx.visuals) && keyValueOn && numCols === 2
        && headerCellNodes.length === 2 && headerCellNodes.every(isEmptyCell)

      if (isKeyValue) {
        const kvCols = typeof ctx.visuals?.table?.keyValue === 'object'
          ? ctx.visuals.table.keyValue.columns ?? ['auto', '2fr']
          : ['auto', '2fr']
        const rows = await Promise.all(bodyRowNodes.map(async (rowNode) => {
          const cells = childrenOf(rowNode).filter(c => Array.isArray(c) || typeof c === 'string')
          return [
            await mapTableCell(cells[0] ?? '', ctx, 'body'),
            await mapTableCell(cells[1] ?? '', ctx, 'body'),
          ]
        }))
        return Table({ columns: kvCols, cellPadding: 0, rowGap: 0, colGap: 0 }, rows) as PDFElement
      }

      const headerCells = headerRowNode ? await mapTableRow(headerRowNode, ctx, 'header') : undefined
      const columns = Array.from({ length: numCols }, () => '1fr' as '1fr')
      const rows = await Promise.all(bodyRowNodes.map(rowNode => mapTableRow(rowNode, ctx, 'body')))
      const cellPad = ctx.visuals?.table?.cellPad ?? { x: 8, y: 6 }
      const paddedInCells = Boolean(ctx.visuals)

      return Table(
        {
          columns,
          header: headerCells,
          cellPadding: paddedInCells ? 0 : cellPad,
          rule: ctx.visuals?.table?.rule ?? ctx.visuals?.ink?.rule ?? '#cccccc',
        },
        rows,
      ) as PDFElement
    }

    case 'svg': {
      const attrStr = Object.entries(attrs)
        .filter(([k]) => k !== '$')
        .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
        .join(' ')
      const space = attrStr ? ` ${attrStr}` : ''
      const inner = children.map(nodeToHtml).join('')
      return Svg(sanitizeSvgLengths(`<svg${space}>${inner}</svg>`)) as PDFElement
    }

    case 'img':
      return embedImage(attrs, ctx)

    case 'input':
      return null

    case 'a': {
      const inner = await ctx.mapNodes(children)
      return (inner.length === 1 ? inner[0] : Column({ gap: 4 }, inner)) as PDFElement
    }

    case 'div':
      return ctx.mapNodes(children)

    case 'page-break':
      return PageBreak() as PDFElement

    default: {
      const inner = await ctx.mapNodes(children)
      if (inner.length === 0) return null
      return (inner.length === 1 ? inner[0] : Column({ gap: 8 }, inner)) as PDFElement
    }
  }
}

const mapNodes = async (nodes: Node[], ctx: JasyMapContext): Promise<PDFElement[]> => {
  const result: PDFElement[] = []
  for (const node of nodes) {
    const mapped = await mapBlockNode(node, ctx)
    if (mapped === null) continue
    if (Array.isArray(mapped)) result.push(...mapped)
    else result.push(mapped)
  }
  return result
}

export type JasyBindingOptions = BindingScope & {
  parseMarkdown?: JasyMapContext['parseMarkdown']
}

const createMapContext = (
  components?: Record<string, JasyComponentFn>,
  textDefaults?: JasyTextDefaults,
  visuals?: PdfVisuals,
  binding?: JasyBindingOptions,
): JasyMapContext => {
  const ctx: JasyMapContext = {
    mapNodes: ns => mapNodes(ns, ctx),
    mapInlineToSpans: (ns, style) => mapInlineToSpans(ns, style ?? {}, ctx),
    withScope: props => createMapContext(components, textDefaults, visuals, { ...binding, props }),
    resolveAttrs: attrs => resolveBoundAttrs(attrs, ctx),
    components,
    textDefaults,
    visuals,
    data: binding?.data,
    frontmatter: binding?.frontmatter,
    props: binding?.props,
    meta: binding?.meta,
    parseMarkdown: binding?.parseMarkdown,
  }
  return ctx
}

export const astToJasy = (
  nodes: Node[],
  components?: Record<string, JasyComponentFn>,
  textDefaults?: JasyTextDefaults,
  visuals?: PdfVisuals,
  binding?: JasyBindingOptions,
): Promise<PDFElement[]> => {
  const ctx = createMapContext(components, textDefaults, visuals, binding)
  return mapNodes(nodes, ctx)
}
