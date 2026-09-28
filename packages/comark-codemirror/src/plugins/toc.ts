/**
 * Table of contents: `meta.toc` (comark's toc plugin) with the document's
 * headings as its live value, for bindings like `::for{:each="meta.toc.links"}`.
 */
import type { Heading } from '../document/index.ts'
import { shapeOf } from '../bindings.ts'
import { definePlugin } from '../plugins.ts'

interface TocLink { id: string, text: string, depth: number, children?: TocLink[] }

function links(headings: readonly Heading[], depth: number): TocLink[] {
  const out: TocLink[] = []
  const stack: TocLink[] = []
  for (const h of headings) {
    if (h.level < 2 || h.level > depth + 1) continue
    const link: TocLink = { id: h.id, text: h.text, depth: h.level }
    while (stack.length && stack.at(-1)!.depth >= h.level) stack.pop()
    const parent = stack.at(-1)
    if (parent) (parent.children ??= []).push(link)
    else out.push(link)
    stack.push(link)
  }
  return out
}

export default definePlugin<{ depth?: number, title?: string }>((options = {}) => ({
  name: 'toc',
  scopes: [({ index }) => ({
    name: 'meta',
    shape: shapeOf({ toc: { title: options.title ?? '', depth: options.depth ?? 2, searchDepth: options.depth ?? 2, links: links(index.headings, options.depth ?? 2) } }),
  })],
  llms: 'A table of contents (`meta.toc`) is generated from h2+ headings.',
}))
