import { Parser } from 'htmlparser2'
import type { Node } from 'comark'

/**
 * Parse an SVG string into Comark AST Nodes.
 *
 * Uses htmlparser2 in XML mode so camelCase SVG tag names (`linearGradient`,
 * `clipPath`) and attribute names (`viewBox`, `preserveAspectRatio`) are
 * preserved, and self-closing elements (`<path d="..." />`) close correctly.
 *
 * All nodes carry `$: { html: 1, block: 1 }` so every renderer treats them as
 * raw HTML and does not try to stringify their attributes as markdown.
 */
export const svgToNodes = (svg: string): Node[] => {
  const root: Node[] = []
  const stack: { tag: string; attrs: Record<string, unknown>; children: Node[] }[] = []

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const attrs: Record<string, unknown> = { $: { html: 1, void: 1 } }
        for (const key in attribs) {
          attrs[key] = attribs[key]
        }
        stack.push({ tag: name, attrs, children: [] })
      },

      ontext(text) {
        const trimmed = text.trim()
        if (!trimmed) return
        if (stack.length > 0) {
          stack[stack.length - 1]!.children.push(trimmed)
        } else {
          root.push(trimmed)
        }
      },

      onclosetag(name) {
        let idx = stack.length - 1
        while (idx >= 0 && stack[idx]!.tag !== name) {
          idx--
        }
        if (idx >= 0) {
          while (stack.length > idx) {
            const frame = stack.pop()!
            const node: Node =
              frame.children.length > 0
                ? ([frame.tag, frame.attrs, ...frame.children] as Node)
                : ([frame.tag, frame.attrs] as Node)
            if (stack.length > 0) {
              stack[stack.length - 1]!.children.push(node)
            } else {
              root.push(node)
            }
          }
        }
      },

      oncomment(data) {
        const node = [null, {}, data] as unknown as Node
        if (stack.length > 0) {
          stack[stack.length - 1]!.children.push(node)
        } else {
          root.push(node)
        }
      },
    },
    { xmlMode: true, decodeEntities: true },
  )

  parser.write(svg.trim())
  parser.end()

  return root
}
