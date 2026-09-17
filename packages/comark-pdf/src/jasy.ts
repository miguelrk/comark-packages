import {
  Column,
  Row,
  Box,
  Text,
  Paragraph,
  Divider,
  Table,
  PageBreak,
  span,
} from '@jasy/pdf'
import type { PDFElement } from '@jasy/pdf'
import type { Node, ElementNode } from 'comark'

export type JasyComponentFn = (element: ElementNode, ctx: JasyMapContext) => PDFElement | null

export interface JasyTextDefaults {
  size?: number
  font?: string | string[]
  color?: string
  lineHeight?: number
  align?: 'left' | 'center' | 'right' | 'justify'
  bold?: boolean
  italic?: boolean
}

export interface JasyMapContext {
  mapNodes(nodes: Node[]): PDFElement[]
  mapInlineToSpans(nodes: Node[], inheritStyle?: Record<string, unknown>): ReturnType<typeof span>[]
  components?: Record<string, JasyComponentFn>
  textDefaults?: JasyTextDefaults
}

const HEADING_SIZES = [28, 22, 18, 16, 14, 13] as const
const DEFAULT_BODY_SIZE = 12

const bodyTextStyle = (
  ctx: JasyMapContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => {
  const d = ctx.textDefaults
  return {
    size: d?.size ?? DEFAULT_BODY_SIZE,
    ...(d?.font !== undefined ? { font: d.font } : {}),
    ...(d?.color !== undefined ? { color: d.color } : {}),
    ...(d?.lineHeight !== undefined ? { lineHeight: d.lineHeight } : {}),
    ...(d?.align !== undefined ? { align: d.align } : {}),
    ...(d?.bold !== undefined ? { bold: d.bold } : {}),
    ...(d?.italic !== undefined ? { italic: d.italic } : {}),
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

    const [tag, attrs, ...children] = node as ElementNode
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
      case 'img': {
        const alt = String(attrs.alt ?? '')
        if (alt) result.push(span(`[${alt}]`, { ...inheritStyle, italic: true, color: '#666666' }))
        continue
      }
      default: {
        // Inline custom components: render their text content as a plain span.
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
  const spans = mapInlineToSpans(children, {}, ctx)
  if (spans.length === 0) return ''
  if (spans.length === 1 && Object.keys(spans[0] as object).length <= 1) {
    return (spans[0] as { text?: string }).text ?? ''
  }
  return spans
}

const mapListItem = (
  children: Node[],
  ctx: JasyMapContext,
): PDFElement[] => {
  if (children.length === 1) {
    const child = children[0]
    if (Array.isArray(child) && (child as ElementNode)[0] === 'p') {
      const [, , ...pChildren] = child as ElementNode
      const content = inlineContent(pChildren, ctx)
      return [Text(content, bodyTextStyle(ctx)) as PDFElement]
    }
  }
  return ctx.mapNodes(children)
}

const mapTableRow = (node: ElementNode, ctx: JasyMapContext): PDFElement[] => {
  const [, , ...cells] = node
  return cells.flatMap((cell) => {
    if (typeof cell === 'string') return [Text(cell, bodyTextStyle(ctx)) as PDFElement]
    const [, attrs, ...children] = cell as ElementNode
    const content = inlineContent(children, ctx)
    const align = String(attrs.align ?? 'left') as 'left' | 'center' | 'right'
    return [Text(content as string, bodyTextStyle(ctx, { align })) as PDFElement]
  })
}

const mapBlockNode = (node: Node, ctx: JasyMapContext): PDFElement | PDFElement[] | null => {
  if (typeof node === 'string') {
    const text = node.trim()
    return text ? Text(text, bodyTextStyle(ctx)) as PDFElement : null
  }

  const [tag, attrs, ...children] = node as ElementNode

  if (tag === null) return null

  const componentFn = ctx.components?.[tag as string]
  if (componentFn) {
    return componentFn(node as ElementNode, ctx)
  }

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = parseInt(String(tag).charAt(1)) - 1
      const content = inlineContent(children, ctx)
      return Text(content as string, {
        size: HEADING_SIZES[level] ?? 12,
        bold: level < 2,
        ...(ctx.textDefaults?.font !== undefined ? { font: ctx.textDefaults.font } : {}),
        ...(ctx.textDefaults?.color !== undefined ? { color: ctx.textDefaults.color } : {}),
      }) as PDFElement
    }

    case 'p': {
      const content = inlineContent(children, ctx)
      if (!content || (typeof content === 'string' && !content.trim())) return null
      return Paragraph(content as string, bodyTextStyle(ctx)) as PDFElement
    }

    case 'blockquote': {
      const inner = ctx.mapNodes(children)
      return Box(
        { borderLeft: '#aaaaaa', borderWidth: 3, padding: { left: 12, top: 4, bottom: 4 } },
        inner.length > 0 ? inner : [Text('') as PDFElement],
      ) as PDFElement
    }

    case 'pre': {
      const code = textContent(children).trimEnd()
      return Box(
        { bg: '#f6f8fa', padding: 12, radius: 4 },
        [Text(code, { font: 'Courier', size: 10 }) as PDFElement],
      ) as PDFElement
    }

    case 'hr':
      return Divider({ color: '#cccccc', margin: { y: 8 } }) as PDFElement

    case 'ul': {
      const items = children.map((child) => {
        if (typeof child === 'string') return null
        const [itemTag, , ...itemChildren] = child as ElementNode
        if (itemTag !== 'li') return null
        const inner = mapListItem(itemChildren, ctx)
        return Row({ gap: 6, align: 'start' }, [
          Text('•', bodyTextStyle(ctx, { color: '#666666' })) as PDFElement,
          Column({ gap: 4 }, inner.length > 0 ? inner : [Text('') as PDFElement]) as PDFElement,
        ]) as PDFElement
      })
      const filteredItems = items.filter((x): x is PDFElement => x !== null)
      return Column({ gap: 6 }, filteredItems.length > 0 ? filteredItems : [Text('') as PDFElement]) as PDFElement
    }

    case 'ol': {
      const items = children.map((child, i) => {
        if (typeof child === 'string') return null
        const [itemTag, , ...itemChildren] = child as ElementNode
        if (itemTag !== 'li') return null
        const inner = mapListItem(itemChildren, ctx)
        return Row({ gap: 6, align: 'start' }, [
          Text(`${i + 1}.`, bodyTextStyle(ctx, { color: '#666666' })) as PDFElement,
          Column({ gap: 4 }, inner.length > 0 ? inner : [Text('') as PDFElement]) as PDFElement,
        ]) as PDFElement
      })
      const filteredItems = items.filter((x): x is PDFElement => x !== null)
      return Column({ gap: 6 }, filteredItems.length > 0 ? filteredItems : [Text('') as PDFElement]) as PDFElement
    }

    case 'li': {
      const inner = mapListItem(children, ctx)
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
      const headerCells = headerRowNode ? mapTableRow(headerRowNode, ctx) : undefined

      const bodyRowNodes = tbody
        ? (tbody as ElementNode).slice(2).filter(Array.isArray) as ElementNode[]
        : []

      const numCols = headerCells?.length ?? (bodyRowNodes[0] ? mapTableRow(bodyRowNodes[0], ctx).length : 1)
      const columns = Array.from({ length: numCols }, () => '1fr' as '1fr')
      const rows = bodyRowNodes.map((rowNode) => mapTableRow(rowNode, ctx))

      return Table(
        {
          columns,
          header: headerCells,
          cellPadding: { x: 8, y: 6 },
          rule: '#cccccc',
        },
        rows,
      ) as PDFElement
    }

    case 'img': {
      const alt = String(attrs.alt ?? '')
      return Text(alt ? `[Image: ${alt}]` : '[Image]', { italic: true, color: '#666666', size: 11 }) as PDFElement
    }

    case 'a': {
      const inner = ctx.mapNodes(children)
      return (inner.length === 1 ? inner[0] : Column({ gap: 4 }, inner)) as PDFElement
    }

    case 'div':
      return ctx.mapNodes(children)

    case 'page-break':
      return PageBreak() as PDFElement

    default: {
      const inner = ctx.mapNodes(children)
      if (inner.length === 0) return null
      return (inner.length === 1 ? inner[0] : Column({ gap: 8 }, inner)) as PDFElement
    }
  }
}

const mapNodes = (nodes: Node[], ctx: JasyMapContext): PDFElement[] => {
  const result: PDFElement[] = []
  for (const node of nodes) {
    const mapped = mapBlockNode(node, ctx)
    if (mapped === null) continue
    if (Array.isArray(mapped)) result.push(...mapped)
    else result.push(mapped)
  }
  return result
}

export const astToJasy = (
  nodes: Node[],
  components?: Record<string, JasyComponentFn>,
  textDefaults?: JasyTextDefaults,
): PDFElement[] => {
  const ctx: JasyMapContext = {
    mapNodes: (ns) => mapNodes(ns, ctx),
    mapInlineToSpans: (ns, style) => mapInlineToSpans(ns, style ?? {}, ctx),
    components,
    textDefaults,
  }
  return mapNodes(nodes, ctx)
}
