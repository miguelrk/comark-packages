/**
 * `llms-full.txt` built from the authored Markdown (frontmatter stripped),
 * in navigation order.
 */
export default defineEventHandler(async (event) => {
  const storage = useStorage('assets:docs')
  const keys = (await storage.getKeys()).filter(k => k.endsWith('.md') && !k.endsWith('index.md')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const parts = ['# comark-vega', '', '> Fenced specs and directives become interactive charts with a shipped Vue renderer.', '']
  for (const key of keys) {
    const raw = String(await storage.getItem(key) ?? '')
    const fm = /^---\n([\s\S]*?)\n---\n?/.exec(raw)
    const titleMatch = fm && /^title:\s*(.+)$/m.exec(fm[1]!)?.[1]?.replace(/^["']|["']$/g, '')
    const body = raw.slice(fm ? fm[0].length : 0).trim()
    parts.push(`# ${titleMatch ?? key}`, '', body, '')
  }
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return parts.join('\n')
})
