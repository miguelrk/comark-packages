/**
 * Menu rendering with CodeMirror's autocomplete hooks: the docs panel
 * (`info`), extra columns (`addToOptions`) and breadcrumb section headers.
 */
import type { Completion, CompletionSection } from '@codemirror/autocomplete'
import type { InfoDocs, Item } from '../types.ts'
import { classHighlighter, highlightCode } from '@lezer/highlight'
import { Emoji, GFM, parser as markdownParser, Subscript, Superscript } from '@lezer/markdown'
import { comarkHighlightStyle, comarkMarkdown } from '../language.ts'

/** A CodeMirror completion that carries its Comark item. */
export interface ComarkCompletion extends Completion {
  item: Item
  chain?: boolean
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

let parser: typeof markdownParser | undefined

/** Comark source as highlighted DOM (same highlight style as the editor). */
export function highlightComark(source: string): HTMLElement {
  // the same extensions as `markdownLanguage` from @codemirror/lang-markdown
  parser ??= markdownParser.configure([GFM, Subscript, Superscript, Emoji, comarkMarkdown])
  const pre = el('pre', 'cm-comark-example')
  const tree = parser.parse(source)
  highlightCode(source, tree, [comarkHighlightStyle, classHighlighter], (text, classes) => {
    if (!classes) pre.append(text)
    else pre.append(el('span', classes, text))
  }, () => pre.append('\n'))
  return pre
}

/** Inline code spans in a plain description (`` `x` ``). */
function prose(text: string, className = 'cm-comark-info-text'): HTMLElement {
  const p = el('div', className)
  text.split(/(`[^`]+`)/).forEach((part) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) p.append(el('code', undefined, part.slice(1, -1)))
    else p.append(part)
  })
  return p
}

export function renderInfo(info: string | InfoDocs): HTMLElement {
  const root = el('div', 'cm-comark-info')
  if (typeof info === 'string') {
    root.append(prose(info))
    return root
  }
  if (info.title) root.append(el('div', 'cm-comark-info-title', info.title))
  if (info.description) root.append(prose(info.description))
  if (info.value !== undefined) {
    const value = el('div', 'cm-comark-info-value')
    value.append(el('span', 'cm-comark-info-label', 'value'), el('code', undefined, typeof info.value === 'string' ? JSON.stringify(info.value) : JSON.stringify(info.value, null, 1)?.slice(0, 400) ?? String(info.value)))
    root.append(value)
  }
  if (info.rows?.length) {
    const table = el('table', 'cm-comark-info-rows')
    for (const [name, type, description] of info.rows.slice(0, 16)) {
      const tr = el('tr')
      tr.append(el('td', 'cm-comark-info-name', name), el('td', 'cm-comark-info-type', type))
      const td = el('td', 'cm-comark-info-desc')
      if (description) td.append(prose(description, 'cm-comark-inline'))
      tr.append(td)
      table.append(tr)
    }
    root.append(table)
  }
  if (info.example) root.append(highlightComark(info.example))
  if (info.link) {
    const a = el('a', 'cm-comark-info-link', 'Docs ↗')
    a.href = info.link
    a.target = '_blank'
    a.rel = 'noopener'
    root.append(a)
  }
  return root
}

/** Extra columns: glyph or swatch before the label, value preview and chevron after. */
export const optionColumns = [
  {
    position: 30,
    render(completion: Completion): Node | null {
      const item = (completion as ComarkCompletion).item
      if (item?.swatch) {
        const swatch = el('span', 'cm-comark-swatch')
        swatch.style.background = item.swatch
        return swatch
      }
      if (item?.glyph) return el('span', 'cm-comark-glyph', item.glyph)
      return null
    },
  },
  {
    position: 90,
    render(completion: Completion): Node | null {
      const item = (completion as ComarkCompletion).item
      if (!item?.drill) return null
      return el('span', 'cm-comark-chevron', '›')
    },
  },
]

const sections = new Map<string, CompletionSection>()

/**
 * Order of sections when nothing is typed yet: a boost for the items of a
 * section. Sections are ranked by their best match (`rank: 'dynamic'`), so
 * once you type, the best match wins; with an empty prefix the boost decides.
 */
export function sectionBoost(section: string, type?: string): number {
  if (type === 'component' || type === 'inline-component' || type === 'slot') return 3
  if (section === 'Structure' || section === 'Lists') return 2
  if (section === 'Callouts' || section === 'Code' || section === 'Math' || section === 'Diagrams' || section === 'Data') return 1
  if (section === 'Used in this document') return -2
  return 0
}

/** A section per name. Names with `›` render as a breadcrumb. */
export function sectionFor(name: string, contextual: boolean): CompletionSection {
  const key = `${contextual ? 1 : 0}:${name}`
  let section = sections.get(key)
  if (!section) {
    section = {
      name,
      // the breadcrumb (what this menu is about) and the closer stay on top; others follow their best match
      rank: name === 'Close' ? -2 : contextual ? -1 : 'dynamic',
      header(s) {
        const li = el('li', 'cm-comark-section')
        li.setAttribute('role', 'presentation')
        const parts = s.name.split(' › ')
        parts.forEach((part, i) => {
          if (i) li.append(el('span', 'cm-comark-crumb-sep', '›'))
          li.append(el('span', i === parts.length - 1 ? 'cm-comark-crumb cm-comark-crumb-last' : 'cm-comark-crumb', part))
        })
        return li
      },
    }
    sections.set(key, section)
  }
  return section
}
