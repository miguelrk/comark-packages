/**
 * Code blocks: fence languages after ```` ``` ```` (from the host's
 * `codeLanguages`, plugins and a common list) and fence meta: `[filename]`,
 * `{1,3-5}` line highlights and `diff`.
 */
import type { CompletionProvider, Item, ProviderContext } from '../types.ts'
import { definePlugin } from '../plugins.ts'

export const COMMON_LANGUAGES = [
  'ts', 'js', 'tsx', 'jsx', 'vue', 'svelte', 'html', 'css', 'scss', 'json', 'jsonc', 'yaml', 'toml', 'md', 'mdc', 'comark',
  'bash', 'sh', 'shell', 'powershell', 'diff', 'sql', 'graphql', 'python', 'rust', 'go', 'java', 'kotlin', 'swift', 'c', 'cpp',
  'csharp', 'php', 'ruby', 'dockerfile', 'xml', 'ini', 'text',
] as const

export interface CodeBlocksOptions {
  /** Languages offered after ```` ``` ```` (merged with the host's and plugins' languages). */
  languages?: readonly string[]
}

export default definePlugin<CodeBlocksOptions>((options = {}) => {
  const providers: CompletionProvider<any>[] = [
    {
      kinds: ['fence-lang'],
      provide(ctx: ProviderContext<'fence-lang'>) {
        const langs = [...new Set([...ctx.config.fences, ...(options.languages ?? COMMON_LANGUAGES)])]
        return langs.map((lang): Item => ({ label: lang, type: 'language' }))
      },
    },
    {
      kinds: ['fence-meta'],
      provide(ctx: ProviderContext<'fence-meta'>) {
        const line = ctx.state.doc.lineAt(ctx.context.pos).text
        const items: Item[] = []
        if (!/\[[^\]]*\]/.test(line)) items.push({ label: '[filename]', insert: `[\${1:file.${ctx.context.lang || 'txt'}}]`, detail: 'file name', type: 'snippet' })
        if (!/\{[^}]*\}/.test(line)) items.push({ label: '{1,3-5}', insert: '{$0}', detail: 'highlight lines', type: 'snippet' })
        if (!/\bdiff\b/.test(line)) items.push({ label: 'diff', detail: 'show as a diff', type: 'keyword' })
        return items
      },
    },
  ]
  return {
    name: 'code-blocks',
    completions: providers,
    snippets: [{ label: 'Code block with file name', insert: '```${1:ts} [${2:file.ts}]\n$0\n```', detail: '```ts [file]', section: 'Code', type: 'fence' }],
    llms: 'Code blocks: ```` ```lang [filename] {1,3-5} ```` — an optional file name in brackets and highlighted lines in braces. Use `diff` for patches.',
  }
})
