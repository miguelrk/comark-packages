/**
 * HTML (default): HTML blocks and inline HTML. Completes tags (minus the
 * ones the security plugin removes), attributes, and the closing tag of the
 * nearest open element after `</`.
 */
import type { CompletionProvider, Item, ProviderContext, ResolvedConfig } from '../types.ts'
import { definePlugin } from '../plugins.ts'

export const HTML_TAGS = [
  'a', 'abbr', 'article', 'aside', 'audio', 'b', 'blockquote', 'br', 'button', 'caption', 'cite', 'code', 'col', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt',
  'em', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'input', 'ins', 'kbd', 'label', 'li', 'mark', 'nav',
  'ol', 'p', 'picture', 'pre', 'q', 's', 'samp', 'section', 'small', 'source', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
  'thead', 'time', 'tr', 'u', 'ul', 'var', 'video', 'wbr',
] as const

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

const ATTRS: Record<string, readonly string[]> = {
  '*': ['class', 'id', 'style', 'title', 'lang', 'dir', 'hidden'],
  'a': ['href', 'target', 'rel'],
  'img': ['src', 'alt', 'width', 'height', 'loading'],
  'video': ['src', 'controls', 'autoplay', 'loop', 'muted', 'poster'],
  'audio': ['src', 'controls'],
  'source': ['src', 'type', 'srcset', 'media'],
  'details': ['open'],
  'td': ['colspan', 'rowspan', 'align'],
  'th': ['colspan', 'rowspan', 'align', 'scope'],
  'input': ['type', 'name', 'value', 'placeholder', 'checked', 'disabled'],
  'time': ['datetime'],
}

/** Tags the security plugin removes (read from its plugin object). */
const blocked = (ctx: { config: ResolvedConfig }) =>
  new Set<string>((ctx.config.plugins.find(p => p.name === 'security') as { blockedTags?: readonly string[] } | undefined)?.blockedTags ?? [])

function openElement(text: string): string | undefined {
  const stack: string[] = []
  for (const t of text.matchAll(/<(\/?)([A-Za-z][\w-]*)[^<>]*?(\/?)>/g)) {
    const name = t[2]!.toLowerCase()
    if (t[3] || VOID.has(name)) continue
    if (t[1]) {
      const i = stack.lastIndexOf(name)
      if (i >= 0) stack.length = i
    }
    else stack.push(name)
  }
  return stack.at(-1)
}

const providers: CompletionProvider<any>[] = [
  {
    kinds: ['html-tag'],
    provide(ctx: ProviderContext<'html-tag'>) {
      const { context } = ctx
      if (context.closing) {
        const start = ctx.state.doc.line(Math.max(1, context.line - 200)).from
        const open = openElement(ctx.state.sliceDoc(start, context.from))
        return open ? [{ label: `</${open}>`, detail: 'close tag', type: 'html' }] : []
      }
      const no = blocked(ctx)
      return HTML_TAGS.filter(t => !no.has(t)).map((tag): Item => ({
        label: `<${tag}`,
        insert: VOID.has(tag) ? `<${tag} $0/>` : `<${tag}>$0</${tag}>`,
        detail: VOID.has(tag) ? 'void' : undefined,
        type: 'html',
      }))
    },
  },
  {
    kinds: ['html-attr'],
    provide: (ctx: ProviderContext<'html-attr'>) => [...(ATTRS[ctx.context.tag] ?? []), ...ATTRS['*']!].map(name => ({ label: name, insert: `${name}="$0"`, type: 'prop', detail: ctx.context.tag })),
  },
]

export default definePlugin(() => ({
  name: 'html',
  completions: providers,
  snippets: [{ label: 'Details', insert: '<details>\n<summary>$1</summary>\n\n$0\n\n</details>', detail: '<details>', section: 'Structure', type: 'html' }],
  llms: 'HTML blocks and inline HTML are allowed (`<div>`, `<br>`, `<details>`). Prefer components over raw HTML.',
}))
