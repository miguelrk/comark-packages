import { describe, expect, it } from 'vitest'
import { templateText, toSnippet } from '../../src/complete/template.ts'
import { completion, labels } from '../helpers.ts'

const FM = '---\ntitle: Hello\nsite:\n  name: My Blog\n  tags: [a, b]\nauthors:\n  - name: Ada\n---\n\n'

describe('templates', () => {
  it('escapes Comark braces and converts stops', () => {
    expect(toSnippet('::card{$1}\n$2\n::')).toBe('::card\\{${1}\\}\n${2}\n::')
    expect(toSnippet('[${1:text}]($2)')).toBe('[${1:text}](${2})')
    expect(toSnippet('**bold**')).toBe('**bold**${0}')
    expect(templateText('::card{$1}\n${2:body}\n::')).toBe('::card{}\nbody\n::')
  })
})

describe('components', () => {
  it('completes block components with their nesting colons', async () => {
    const res = await completion('::ca|')
    const card = res!.items.find(i => i.label === '::card')!
    expect(card).toMatchObject({ insert: '::card{}\n\n::', chain: true, section: 'Layout' })
    expect(res!.items.find(i => i.label === '::note')).toMatchObject({ insert: '::note\n\n::', chain: false })
    expect((await completion('::card\n:::|\n::'))!.items.find(i => i.label === ':::note')!.insert).toBe(':::note\n\n:::')
    expect(await labels('::ca|')).not.toContain('::badge')
  })

  it('offers the closer first', async () => {
    const res = await completion('::card\ntext\n::|')
    expect(res!.items[0]).toMatchObject({ label: '::', detail: 'close ::card', section: 'Close' })
  })

  it('indents continuation lines inside list items', async () => {
    const res = await completion('- ::no|')
    expect(res!.items.find(i => i.label === '::note')!.insert).toBe('::note\n  \n  ::')
  })

  it('completes inline components', async () => {
    const items = await labels('Hi :ba|')
    expect(items![0]).toBe(':badge')
    expect(items).not.toContain(':card')
  })

  it('lists props: required first, set ones hidden, then attributes', async () => {
    expect(await labels('::card{|}')).toEqual(['title', 'variant', 'flat', 'value', '.class', '#id', 'style'])
    expect(await labels('::card{title="x" |}')).toEqual(['variant', 'flat', 'value', '.class', '#id', 'style'])
  })

  it('inserts props as the next chain step', async () => {
    const items = (await completion('::card{|}'))!.items
    expect(items.find(i => i.label === 'variant')).toMatchObject({ insert: 'variant=""', chain: true })
    expect(items.find(i => i.label === 'flat')).toMatchObject({ insert: 'flat', chain: true })
    const after = (await completion('::card{title="x"|}'))!.items
    expect(after.find(i => i.label === 'variant')!.insert).toBe(' variant=""')
  })

  it('switches to bindable props after `:` and model props after `::`', async () => {
    expect(await labels('::card{:|}')).toEqual([':title', ':variant', ':flat', ':value'])
    expect(await labels('::card{::|}')).toEqual(['::value'])
  })

  it('completes values: enum, boolean, default and values used elsewhere', async () => {
    expect(await labels('::card{variant="|"}')).toEqual(['primary', 'ghost'])
    const res = await completion('::card{variant="|"}')
    expect(res!.items[0]).toMatchObject({ chain: true, detail: 'default' })
    expect(await labels('::card{title="Hello"}\n::\n::card{title="|"}\n::')).toEqual(['Hello'])
  })

  it('completes slots of the innermost component', async () => {
    expect(await labels('::card\n#|\n::')).toEqual(['#footer', '#default'])
    expect(await labels('::card\n#footer{|}\n::')).toContain('unwrap')
  })

  it('completes YAML props blocks', async () => {
    expect(await labels('::card\n---\n|\n---\n::')).toEqual(['title', 'variant', 'flat', 'value'])
    expect(await labels('::card\n---\ntitle: x\n|\n---\n::')).toEqual(['variant', 'flat', 'value'])
    expect(await labels('::card\n---\nvariant: |\n---\n::')).toEqual(['primary', 'ghost'])
  })

  it('suggests names used in the document when the manifest does not know them', async () => {
    const res = await completion('::hero\n::\n::he|')
    expect(res!.items.find(i => i.label === '::hero')).toMatchObject({ section: 'Used in this document' })
  })

  it('respects `children` constraints', async () => {
    const res = await completion('::list\n:::|\n::', { components: [{ name: 'list', kind: 'block', children: ['item'] }, { name: 'item', kind: 'block' }, { name: 'other', kind: 'block' }] })
    expect(res!.items.map(i => i.label)).toEqual([':::item'])
  })
})

describe('bindings', () => {
  it('lists the roots', async () => {
    expect(await labels(`${FM}Hi {{ |}}`)).toEqual(['frontmatter', 'meta'])
    expect(await labels(`${FM}::card{:title="|"}\n::`)).toEqual(['frontmatter', 'meta'])
  })

  it('walks the live frontmatter segment by segment', async () => {
    const root = (await completion(`${FM}Hi {{ |}}`))!.items[0]!
    expect(root).toMatchObject({ label: 'frontmatter', insert: 'frontmatter.', chain: true })
    expect(await labels(`${FM}Hi {{ frontmatter.|}}`)).toEqual(['title', 'site', 'authors'])
    const site = await completion(`${FM}Hi {{ frontmatter.site.|}}`)
    expect(site!.items.map(i => [i.label, i.detail])).toEqual([['name', '"My Blog"'], ['tags', 'list [2]']])
    expect(await labels(`${FM}Hi {{ frontmatter.authors.|}}`)).toEqual(['0', 'length'])
    expect(await labels(`${FM}Hi {{ frontmatter.authors.0.|}}`)).toEqual(['name'])
  })

  it('leaves quoted values and continues the chain in bound props', async () => {
    const res = await completion(`${FM}::card{:title="frontmatter.|"}\n::`)
    expect(res!.items.find(i => i.label === 'title')).toMatchObject({ chain: true })
  })

  it('offers the enclosing component\'s props', async () => {
    const doc = '::card{title="Hi" variant="ghost"}\n:badge{:color="props.|"}\n::'
    expect(await labels(doc.replace('props.|', '|'))).toEqual(['frontmatter', 'props', 'meta'])
    expect(await labels(doc)).toEqual(['title', 'variant', 'flat', 'value'])
  })

  it('does not offer props on the component\'s own opener', async () => {
    expect(await labels('::card{title="x" :variant="|"}\n::')).toEqual(['frontmatter', 'meta'])
  })

  it('offers data and meta from the host, and only writable roots for ::model', async () => {
    const options = { data: { user: { name: 'Ada' }, items: [{ id: 1 }] }, metaSchema: { type: 'object', properties: { lang: { type: 'string' } } } }
    expect(await labels('Hi {{ |}}', options)).toEqual(['frontmatter', 'data', 'meta'])
    expect(await labels('Hi {{ data.|}}', options)).toEqual(['user', 'items'])
    expect(await labels('Hi {{ meta.|}}', options)).toEqual(['lang', 'title', 'description', 'toc'])
    expect(await labels('::card{::value="|"}\n::', options)).toEqual(['data'])
  })

  it('introduces loop variables from `::for`', async () => {
    const options = { data: { posts: [{ title: 'A', slug: 'a' }] } }
    expect(await labels('::for{:each="data.posts" item="post"}\n{{ |}}\n::', options)).toContain('post')
    expect(await labels('::for{:each="data.posts" item="post"}\n{{ post.|}}\n::', options)).toEqual(['title', 'slug'])
  })

  it('offers a fallback after a complete path', async () => {
    expect(await labels(`${FM}{{ frontmatter.title |}}`)).toEqual(['||'])
    expect(await labels(`${FM}{{ frontmatter.title || ‸}}`)).toEqual(['Hello'])
  })

  it('offers true/false for bound boolean props', async () => {
    expect(await labels('::card{:flat="|"}\n::')).toEqual(['frontmatter', 'meta', 'true', 'false'])
  })
})

describe('block and inline menus', () => {
  it('shows components, structure, snippets and slots on `/`', async () => {
    const items = (await completion('/|'))!.items
    const sections = [...new Set(items.map(i => i.section))]
    expect(sections).toEqual(expect.arrayContaining(['Layout', 'Structure', 'Lists', 'Code', 'Callouts', 'Logic', 'Etiket']))
    expect(items.find(i => i.label === 'Table')!.insert).toContain('| Column | Column |')
    const inCard = (await completion('::card\n/|\n::'))!.items
    expect(inCard.find(i => i.label === '#footer')).toMatchObject({ section: 'Slots' })
    expect(inCard.find(i => i.label === 'note')!.insert).toBe(':::note\n\n:::')
  })

  it('offers frontmatter on line 1', async () => {
    expect(await labels('---|')).toEqual(['---'])
    expect((await completion('/|'))!.items.find(i => i.label === 'Frontmatter')).toBeTruthy()
    expect((await completion('# x\n/|'))!.items.find(i => i.label === 'Frontmatter')).toBeUndefined()
  })

  it('has an inline menu on Ctrl-Space', async () => {
    expect(await labels('Some te|', { explicit: true })).toEqual(expect.arrayContaining(['bold', 'link', 'span', 'binding', 'math']))
  })
})

describe('plugin syntax', () => {
  it('alerts, tasks, footnotes, anchors', async () => {
    expect(await labels('> [!|')).toEqual(['[!NOTE]', '[!TIP]', '[!IMPORTANT]', '[!WARNING]', '[!CAUTION]'])
    expect(await labels('- [|')).toEqual(['[ ]', '[x]'])
    expect(await labels('A[^1] b[^|\n\n[^1]: One')).toEqual(['1', '2'])
    expect(await labels('# Intro\n## Setup\nSee [x](#|)')).toEqual(['#intro', '#setup'])
  })

  it('fence languages and meta', async () => {
    const langs = await labels('```|')
    expect(langs).toEqual(expect.arrayContaining(['ts', 'mermaid', 'json-render', 'math', 'flint']))
    expect(await labels('```ts |')).toEqual(['[filename]', '{1,3-5}', 'diff', 'twoslash'])
    expect(await labels('```py |')).toEqual(['[filename]', '{1,3-5}', 'diff'])
    expect(await labels('```ts twoslash\nconst a = 1\n// |\n```')).toContain('// ^?')
  })

  it('mermaid diagram types and keywords', async () => {
    expect(await labels('```mermaid\n|\n```', { explicit: true })).toContain('sequenceDiagram')
    expect(await labels('```mermaid\nflowchart TD\n  sub|\n```')).toContain('subgraph')
  })

  it('emoji after two characters, with glyphs', async () => {
    const res = await completion('Nice :ta|')
    expect(res!.items.some(i => i.label === ':tada:')).toBe(true)
    expect((await labels('Nice :t|'))!.some(l => l === ':tada:')).toBe(false)
  })

  it('html tags (minus blocked ones), attributes and closers', async () => {
    const tags = await labels('x <|')
    expect(tags).toContain('<details')
    expect(tags).not.toContain('<script')
    expect(await labels('<div>\ntext </|')).toEqual(['</div>'])
    expect(await labels('<a hr|')).toContain('href')
  })

  it('math commands', async () => {
    expect((await completion('$\\al|$'))!.items.find(i => i.label === '\\alpha')).toBeTruthy()
  })

  it('frontmatter keys and values from a schema', async () => {
    const frontmatterSchema = { type: 'object', required: ['title'], properties: { title: { type: 'string' }, status: { enum: ['draft', 'published'] }, seo: { type: 'object', properties: { image: { type: 'string' } } } } }
    expect(await labels('---\n|\n---', { frontmatterSchema })).toEqual(['title', 'status', 'seo'])
    expect(await labels('---\nstatus: |\n---', { frontmatterSchema })).toEqual(['draft', 'published'])
    expect(await labels('---\nseo:\n  |\n---', { frontmatterSchema })).toEqual(['image'])
  })

  it('host links and assets', async () => {
    const links = [{ url: '/docs', title: 'Docs' }, { url: '/logo.png', kind: 'asset' as const }]
    expect(await labels('[x](|)', { links })).toEqual(['/docs'])
    expect(await labels('![x](|)', { links })).toEqual(['/logo.png'])
  })

  it('attributes on inline elements use classes and ids from the document', async () => {
    expect(await labels('**a**{.hot}\n[b]{.|}')).toEqual(['hot'])
    expect(await labels('# Top\n[b]{#|}')).toEqual(['top'])
    expect(await labels('[a](b){|}')).toEqual(['target', 'rel', '.class', '#id', 'style'])
  })
})
