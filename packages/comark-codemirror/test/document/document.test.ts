import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { attrCursor, formatAttributes, parseAttributes, scanAttributes } from '../../src/document/attributes.ts'
import { docIndex } from '../../src/document/index.ts'
import { headingText, outline, slugify } from '../../src/document/outline.ts'
import { parseYaml, yamlCursor } from '../../src/document/yaml.ts'

describe('attributes', () => {
  it('parses every attribute form', () => {
    const entries = parseAttributes('{#id .a .b title="Hi" :bound="data.x" ::model="data.y" @click flag n=3}')
    expect(entries.map(e => [e.key, e.value])).toEqual([
      ['id', 'id'],
      ['class', 'a b'],
      ['title', 'Hi'],
      [':bound', 'data.x'],
      ['::model', 'data.y'],
      ['@click', true],
      ['flag', true],
      ['n', '3'],
    ])
    expect(entries[3]).toMatchObject({ prefix: ':', name: 'bound' })
    expect(entries[4]).toMatchObject({ prefix: '::', name: 'model' })
  })

  it('tokenizes unterminated input', () => {
    const { tokens, closed } = scanAttributes('{title="x')
    expect(closed).toBe(false)
    expect(tokens.map(t => t.type)).toEqual(['open', 'key', 'equals', 'value'])
  })

  it('knows where the cursor is', () => {
    expect(attrCursor('')).toMatchObject({ at: 'key', typed: '', separated: true })
    expect(attrCursor('ti')).toMatchObject({ at: 'key', typed: 'ti' })
    expect(attrCursor('title="x" va')).toMatchObject({ at: 'key', typed: 'va', present: ['title'] })
    expect(attrCursor('title="x"')).toMatchObject({ at: 'key', separated: false })
    expect(attrCursor(':ti')).toMatchObject({ at: 'key', typed: ':ti', prefix: ':' })
    expect(attrCursor('variant="pr')).toMatchObject({ at: 'value', typed: 'pr', name: 'variant', quote: '"' })
    expect(attrCursor(':title="frontmatter.si')).toMatchObject({ at: 'value', prefix: ':', typed: 'frontmatter.si' })
    expect(attrCursor('.bi')).toMatchObject({ at: 'class', typed: 'bi' })
    expect(attrCursor('#ma')).toMatchObject({ at: 'id', typed: 'ma' })
  })

  it('formats props', () => {
    expect(formatAttributes({ id: 'x', class: 'a b', title: 'Hi "you"', flag: true, off: false, data: { a: 1 } }))
      .toBe('{#x .a .b title="Hi &quot;you&quot;" flag :data=\'{"a":1}\'}')
  })
})

describe('yaml', () => {
  it('parses nested maps, lists, flow collections and scalars', () => {
    expect(parseYaml([
      'title: Hello',
      'count: 42',
      'draft: false',
      'site:',
      '  name: "My Blog"',
      '  tags: [a, b]',
      'authors:',
      '  - name: Ada',
      '    role: lead',
      '  - name: Grace',
      'list:',
      '- one',
      '- 2',
      'bio: |',
      '  line one',
      '  line two',
    ])).toEqual({
      title: 'Hello',
      count: 42,
      draft: false,
      site: { name: 'My Blog', tags: ['a', 'b'] },
      authors: [{ name: 'Ada', role: 'lead' }, { name: 'Grace' }],
      list: ['one', 2],
      bio: 'line one\nline two',
    })
  })

  it('finds the key path at the cursor', () => {
    expect(yamlCursor(['site:', '  name: x'], '  ')).toEqual({ at: 'key', path: ['site'], typed: '', present: ['name'] })
    expect(yamlCursor(['title: x'], 'dra')).toEqual({ at: 'key', path: [], typed: 'dra', present: ['title'] })
    expect(yamlCursor(['site:'], '  theme: da')).toEqual({ at: 'value', path: ['site'], key: 'theme', typed: 'da' })
    expect(yamlCursor(['tags:'], '  - ma')).toEqual({ at: 'item', path: ['tags'], typed: 'ma' })
  })
})

describe('outline', () => {
  it('indexes frontmatter, components, props blocks, slots, fences and headings', () => {
    const nodes = outline([
      '---',
      'title: T',
      '---',
      '# Intro',
      '::card{title="A"}',
      '---',
      'icon: star',
      '---',
      'Body',
      '#footer{unwrap="p"}',
      ':::inner',
      'x',
      ':::',
      '::',
      '```ts [a.ts]',
      '::not-a-component',
      '```',
      '## Next',
    ].join('\n'))
    const brief = nodes.map(n => [n.kind, n.name, n.line, n.endLine, n.closed])
    expect(brief).toEqual([
      ['frontmatter', 'frontmatter', 1, 3, true],
      ['heading', 'Intro', 4, 18, true],
      ['component', 'card', 5, 14, true],
      ['slot', 'footer', 10, 10, true],
      ['component', 'inner', 11, 13, true],
      ['fence', 'ts', 15, 17, true],
      ['heading', 'Next', 18, 18, true],
    ])
    expect(nodes[2]).toMatchObject({ colons: 2, props: { line: 7, endLine: 7, closed: true }, attrs: { text: '{title="A"}' } })
    expect(nodes[4]).toMatchObject({ colons: 3, parent: 2, depth: 1 })
    expect(nodes[5]).toMatchObject({ info: '[a.ts]' })
  })

  it('treats an empty ---/--- as thematic breaks (comark)', () => {
    expect(outline('---\n---\n# A').map(n => n.kind)).toEqual(['heading'])
  })

  it('reports unclosed blocks', () => {
    const nodes = outline('::card\ntext\n```js\ncode')
    expect(nodes.map(n => [n.kind, n.closed])).toEqual([['component', false], ['fence', false]])
  })

  it('builds comark heading ids (children of an explicit id use the slug, like comark)', () => {
    const ids = outline('# Top\n## Install\n### Linux\n## Install\n## Use {#custom}\n### 2 Things').filter(n => n.kind === 'heading').map(n => n.id)
    expect(ids).toEqual(['top', 'install', 'install-linux', 'install-1', 'custom', 'use-_2-things'])
    expect(slugify('Hello, World!')).toBe('hello-world')
    expect(headingText('**Bold** `code` [link](x) {.cls}')).toEqual({ text: 'Bold code link', explicitId: undefined })
  })
})

describe('docIndex', () => {
  const state = EditorState.create({ doc: [
    '---',
    'site:',
    '  name: Blog',
    '---',
    '# Title',
    '::card{title="A" .big}',
    '---',
    'icon: star',
    '---',
    'Text[^1] :badge{color="red"}',
    '::',
    '',
    '[^1]: A note',
  ].join('\n') })
  const index = docIndex(state)

  it('parses the frontmatter', () => expect(index.frontmatter.value).toEqual({ site: { name: 'Blog' } }))
  it('is memoized per document', () => expect(docIndex(state)).toBe(index))
  it('collects footnotes, classes and component usages', () => {
    expect([...index.footnotes.keys()]).toEqual(['1'])
    expect(index.footnoteRefs.map(r => r.id)).toEqual(['1'])
    expect([...index.usages.classes]).toEqual(['big'])
    expect([...index.usages.components].sort()).toEqual(['badge', 'card'])
    expect(index.usages.values.get('card.title')).toEqual(new Set(['A']))
  })
  it('merges inline and YAML props', () => {
    const card = index.outline.find(n => n.kind === 'component')!
    expect(index.propsOf(card)).toEqual({ title: 'A', class: 'big', icon: 'star' })
  })
  it('knows the stack and regions', () => {
    expect(index.stackAt(10).map(n => n.name)).toEqual(['card'])
    expect(index.stackAt(6)).toEqual([])
    expect(index.regionAt(2)?.kind).toBe('frontmatter')
    expect(index.regionAt(8)?.kind).toBe('props')
    expect(index.regionAt(10)).toBeUndefined()
  })
})
