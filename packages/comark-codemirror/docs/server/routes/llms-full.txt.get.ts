/**
 * `llms-full.txt` built from the authored Markdown (frontmatter stripped),
 * in navigation order. Replaces the generated version, which re-stringifies
 * the parsed AST and currently overflows the stack on bold text upstream.
 */
export default defineEventHandler(async (event) => {
  const storage = useStorage('assets:docs')
  const keys = (await storage.getKeys()).filter(k => k.endsWith('.md') && !k.endsWith('index.md')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const parts = ['# comark-codemirror', '', '> A Comark code editor for CodeMirror 6 where you can autocomplete everything, in chained menus.', '']
  for (const key of keys) {
    const raw = String(await storage.getItem(key) ?? '')
    const fm = /^---\n([\s\S]*?)\n---\n?/.exec(raw)
    const title = fm && /^title:\s*(.+)$/m.exec(fm[1]!)?.[1]?.replace(/^["']|["']$/g, '')
    const body = raw.slice(fm ? fm[0].length : 0).trim()
    parts.push(`# ${title ?? key}`, '', body, '')
  }
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return parts.join('\n')
})
