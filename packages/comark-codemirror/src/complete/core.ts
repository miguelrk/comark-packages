/**
 * Core providers: CommonMark/GFM structure in the block menu, inline marks
 * in the inline menu, and every plugin's declarative snippets.
 */
import type { CompletionProvider, Item } from '../types.ts'

const structure: Item[] = [
  { label: 'Heading 1', insert: '# $0', section: 'Structure', type: 'heading', detail: '#' },
  { label: 'Heading 2', insert: '## $0', section: 'Structure', type: 'heading', detail: '##' },
  { label: 'Heading 3', insert: '### $0', section: 'Structure', type: 'heading', detail: '###' },
  { label: 'Bullet list', insert: '- $0', section: 'Lists', type: 'list', detail: '-' },
  { label: 'Numbered list', insert: '1. $0', section: 'Lists', type: 'list', detail: '1.' },
  { label: 'Quote', insert: '> $0', section: 'Structure', type: 'quote', detail: '>' },
  { label: 'Table', insert: '| ${1:Column} | ${2:Column} |\n| --- | --- |\n| $3 | $4 |', section: 'Structure', type: 'table', detail: '| |' },
  { label: 'Divider', insert: '***\n$0', section: 'Structure', type: 'divider', detail: '***' },
  { label: 'Code block', insert: '```$0\n\n```', section: 'Code', type: 'fence', detail: '```', chain: true },
]

const inline: Item[] = [
  { label: 'bold', insert: '**$0**', type: 'mark', detail: '**text**' },
  { label: 'italic', insert: '_$0_', type: 'mark', detail: '_text_' },
  { label: 'code', insert: '`$0`', type: 'mark', detail: '`code`' },
  { label: 'strikethrough', insert: '~~$0~~', type: 'mark', detail: '~~text~~' },
  { label: 'link', insert: '[${1:text}]($2)', type: 'link', detail: '[text](url)' },
  { label: 'image', insert: '![${1:alt}]($2)', type: 'image', detail: '![alt](src)' },
  { label: 'span', insert: '[${1:text}]{$2}', type: 'mark', detail: '[text]{.class}', info: 'A span with attributes: `[text]{.class #id key="value"}`.' },
]

export const coreProviders: readonly CompletionProvider<any>[] = [
  {
    kinds: ['block'],
    provide: ({ context }) => (context.kind === 'block' && context.typed.startsWith('-') ? [] : structure),
  },
  {
    kinds: ['inline'],
    provide: () => inline,
  },
  {
    kinds: ['link-url'],
    async provide({ context, config }) {
      const links = config.options.links
      if (!links || context.kind !== 'link-url' || context.anchor) return null
      const list = typeof links === 'function' ? await links(context.typed) : links
      return list
        .filter(l => (context.image ? l.kind === 'asset' : l.kind !== 'asset'))
        .map((l): Item => ({ label: l.url, detail: l.title, type: l.kind === 'asset' ? 'image' : 'link', section: l.kind === 'asset' ? 'Assets' : 'Pages' }))
    },
  },
  {
    kinds: ['block', 'inline'],
    provide: ({ context, config }) => {
      if (context.kind === 'block' && context.typed.startsWith('-')) return []
      const want = context.kind === 'inline' ? 'inline' : 'block'
      return config.plugins.flatMap(p => p.snippets ?? [])
        .filter(s => (s.context ?? 'block') === want)
        .map(s => ({ label: s.label, insert: s.insert, detail: s.detail, info: s.info, type: s.type ?? 'snippet', section: s.section ?? 'Snippets', chain: s.chain }))
    },
  },
]
