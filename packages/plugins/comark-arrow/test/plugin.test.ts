import { createMarkdownParser, parseMarkdown } from 'comark'
import type { ElementNode } from 'comark'
import { renderMarkdown } from 'comark/render'
import rangi from 'comark/plugins/rangi'
import { describe, expect, it } from 'vitest'
import arrow, { ARROW_TAG } from '../src/index.ts'
import type { ArrowSandboxAttrs } from '../src/index.ts'
import { ArrowSandbox as htmlFallback } from '../src/html.ts'

const findArrow = (nodes: unknown[]): ElementNode | undefined => {
  for (const n of nodes) {
    if (!Array.isArray(n)) continue
    const el = n as ElementNode
    if (String(el[0]) === ARROW_TAG) return el
    const nested = findArrow(el.slice(2) as unknown[])
    if (nested) return nested
  }
  return undefined
}

const SAMPLE_SOURCE = `import { html, reactive } from '@arrow-js/core'

const state = reactive({ count: 0 })

export default html\`
  <button @click="\${() => state.count++}">
    Clicked \${() => state.count}
  </button>
\`
`

describe('comark-arrow parse', () => {
  it('rewrites a fenced arrow block to ArrowSandbox with ready status', async () => {
    const md = '```arrow\n' + SAMPLE_SOURCE + '\n```\n'
    const tree = await parseMarkdown(md, { plugins: [arrow()] })
    const node = findArrow(tree.nodes)
    expect(node).toBeDefined()
    const attrs = node![1] as ArrowSandboxAttrs
    expect(attrs.source).toContain('reactive')
    expect(attrs.status).toBe('ready')
    expect(tree.meta.arrow?.count).toBe(1)
  })

  it('parses fence attrs height and shadow-dom', async () => {
    const md =
      '```arrow {height="320px" shadow-dom="false"}\n' +
      SAMPLE_SOURCE +
      '\n```\n'
    const tree = await parseMarkdown(md, { plugins: [arrow()] })
    const attrs = findArrow(tree.nodes)![1] as ArrowSandboxAttrs
    expect(attrs.height).toBe('320px')
    expect(attrs.shadowDom).toBe(false)
  })

  it('keeps :source on ::arrow directive when unbound', async () => {
    const tree = await parseMarkdown('::arrow{:source="widgets.reorder"}\n::\n', {
      plugins: [arrow()],
    })
    const attrs = findArrow(tree.nodes)![1] as ArrowSandboxAttrs
    expect(attrs[':source']).toBe('widgets.reorder')
    expect(attrs.status).toBe('ready')
  })

  it('resolves :source from frontmatter when present', async () => {
    const md = `---
widgets:
  reorder: "export default html\`<div>hi</div>\`"
---

::arrow{:source="widgets.reorder"}
::
`
    const tree = await parseMarkdown(md, { plugins: [arrow()] })
    const attrs = findArrow(tree.nodes)![1] as ArrowSandboxAttrs
    expect(attrs.source).toContain('export default')
  })

  it('pairs an adjacent arrow-css fence into css and removes it', async () => {
    const md =
      '```arrow\n' +
      SAMPLE_SOURCE +
      '\n```\n\n```arrow-css\nbutton { color: red; }\n```\n'
    const tree = await parseMarkdown(md, { plugins: [arrow()] })
    const attrs = findArrow(tree.nodes)![1] as ArrowSandboxAttrs
    expect(attrs.css).toContain('color: red')
    const json = JSON.stringify(tree.nodes)
    expect(json).not.toContain('arrow-css')
    expect(json).not.toContain('language-arrow-css')
  })

  it('marks the last fence pending when streaming option is on', async () => {
    const parse = createMarkdownParser({
      plugins: [arrow({ streaming: true })],
    })
    const incomplete = '```arrow\nconst state = reactive({ n: 0 })\n'
    const tree = await parse(incomplete, { streaming: true })
    const attrs = findArrow(tree.nodes)![1] as ArrowSandboxAttrs
    expect(attrs.status).toBe('pending')
  })

  it('marks ready after a complete non-streaming parse', async () => {
    const md = '```arrow\n' + SAMPLE_SOURCE + '\n```\n'
    const tree = await parseMarkdown(md, {
      plugins: [arrow({ streaming: false })],
    })
    expect((findArrow(tree.nodes)![1] as ArrowSandboxAttrs).status).toBe(
      'ready',
    )
  })

  it('produces a JSON-serializable tree', async () => {
    const md = '```arrow\n' + SAMPLE_SOURCE + '\n```\n'
    const tree = await parseMarkdown(md, { plugins: [arrow()] })
    expect(() => JSON.stringify(tree)).not.toThrow()
  })

  it('round-trips through renderMarkdown', async () => {
    const md = '```arrow\n' + SAMPLE_SOURCE + '\n```\n'
    const tree = await parseMarkdown(md, { plugins: [arrow()] })
    const out = await renderMarkdown(tree)
    expect(out).toMatch(/ArrowSandbox|```arrow/i)
  })

  it('claims arrow fences even when rangi is registered', async () => {
    const md = '```arrow\n' + SAMPLE_SOURCE + '\n```\n'
    const tree = await parseMarkdown(md, {
      plugins: [rangi(), arrow()],
    })
    const node = findArrow(tree.nodes)
    expect(node).toBeDefined()
    expect(String(node![0])).toBe(ARROW_TAG)
  })

  it('does not put hostBridge on AST attrs', async () => {
    const md = '```arrow\n' + SAMPLE_SOURCE + '\n```\n'
    const tree = await parseMarkdown(md, { plugins: [arrow()] })
    const attrs = findArrow(tree.nodes)![1] as Record<string, unknown>
    expect(attrs.hostBridge).toBeUndefined()
    expect(JSON.stringify(attrs)).not.toContain('hostBridge')
  })

  it('can be disabled', async () => {
    const md = '```arrow\n' + SAMPLE_SOURCE + '\n```\n'
    const tree = await parseMarkdown(md, {
      plugins: [arrow({ enabled: false })],
    })
    expect(findArrow(tree.nodes)).toBeUndefined()
    expect(tree.meta.arrow).toBeUndefined()
  })
})

describe('comark-arrow html fallback', () => {
  it('emits a non-empty caption fallback', () => {
    const html = htmlFallback([
      'ArrowSandbox',
      { source: SAMPLE_SOURCE, fallback: 'caption' },
    ] as ElementNode)
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('Interactive widget')
  })

  it('emits escaped source when fallback=source', () => {
    const html = htmlFallback([
      'ArrowSandbox',
      { source: '<script>x</script>', fallback: 'source' },
    ] as ElementNode)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})
