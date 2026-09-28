import { describe, expect, it } from 'vitest'
import { resolveContext } from '../../src/context/resolve.ts'
import { labels, stateWith } from '../helpers.ts'

const at = (src: string, explicit = false) => {
  const { state, pos } = stateWith(src)
  return resolveContext(state, pos, { explicit })
}

const FM = '---\ntitle: T\nsite:\n  name: Blog\n---\n'

describe('resolveContext', () => {
  it.each([
    // [document with |, expected subset]
    ['/|', { kind: 'block', slash: true, typed: '' }],
    ['/tab|', { kind: 'block', slash: true, typed: 'tab' }],
    ['---|', { kind: 'block', typed: '---' }],
    ['::ca|', { kind: 'component-name', inline: false, colons: 2, typed: '::ca' }],
    ['::card\n:::|\n::', { kind: 'component-name', colons: 3, typed: ':::' }],
    ['- ::ca|', { kind: 'component-name', typed: '::ca' }],
    ['Hello :ba|', { kind: 'component-name', inline: true, colons: 1, typed: ':ba' }],
    ['Hello :+1|', { kind: 'emoji', typed: ':+1' }],
    ['::card{|}', { kind: 'attr-key', typed: '', prefix: '', separated: true, owner: { type: 'component', name: 'card', inline: false } }],
    ['::card{ti|', { kind: 'attr-key', typed: 'ti' }],
    ['::card{title="x" |}', { kind: 'attr-key', typed: '', present: ['title'] }],
    ['::card{title="x"|}', { kind: 'attr-key', separated: false }],
    ['::card[label]{|}', { kind: 'attr-key', owner: { type: 'component', name: 'card' } }],
    [':badge{|}', { kind: 'attr-key', owner: { type: 'component', name: 'badge', inline: true } }],
    ['::card{:|}', { kind: 'attr-key', prefix: ':', typed: ':' }],
    ['::card{::va|}', { kind: 'attr-key', prefix: '::', typed: '::va' }],
    ['::card{variant="|"}', { kind: 'attr-value', name: 'variant', typed: '' }],
    ['::card{variant="pri|', { kind: 'attr-value', name: 'variant', typed: 'pri' }],
    ['::card{.|}', { kind: 'attr-class', typed: '' }],
    ['::card{#ma|}', { kind: 'attr-id', typed: 'ma' }],
    ['::card{:title="|"}', { kind: 'binding-path', mode: 'bound', segments: [], key: 'title' }],
    ['::card{:title="frontmatter.si|"}', { kind: 'binding-path', segments: ['frontmatter'], typed: 'si' }],
    ['::card{::value="data.|"}', { kind: 'binding-path', mode: 'model', segments: ['data'] }],
    ['Hi {{ |}}', { kind: 'binding-path', mode: 'interpolation', segments: [] }],
    ['Hi {{ frontmatter.site.na|}}', { kind: 'binding-path', segments: ['frontmatter', 'site'], typed: 'na' }],
    ['Hi {{ frontmatter.title |}}', { kind: 'binding-default', path: 'frontmatter.title' }],
    ['Hi {{ a.b || gu‸}}', { kind: 'binding-default', path: 'a.b', typed: 'gu' }],
    ['::card\n#|\n::', { kind: 'slot', typed: '#' }],
    ['::card\n#fo|\n::', { kind: 'slot', typed: '#fo' }],
    ['::card\n#footer{|}\n::', { kind: 'attr-key', owner: { type: 'slot', name: 'footer' } }],
    ['::card\n---\n|\n---\n::', { kind: 'props-key', path: [], typed: '' }],
    ['::card\n---\nvariant: g|\n---\n::', { kind: 'props-value', key: 'variant', typed: 'g' }],
    [`${FM.replace('site:\n  name: Blog\n', 'dr|\n')}`, { kind: 'frontmatter-key', typed: 'dr', present: ['title'] }],
    ['---\nsite:\n  |\n---', { kind: 'frontmatter-key', path: ['site'] }],
    ['---\nstatus: dr|\n---', { kind: 'frontmatter-value', key: 'status', typed: 'dr' }],
    ['```|', { kind: 'fence-lang', typed: '' }],
    ['```ty|', { kind: 'fence-lang', typed: 'ty' }],
    ['```ts |', { kind: 'fence-meta', lang: 'ts', typed: '' }],
    ['```mermaid\nfl|\n```', { kind: 'fence-body', lang: 'mermaid', typed: 'fl' }],
    ['> [!|', { kind: 'alert', typed: '[!' }],
    ['- [|', { kind: 'task', typed: '[' }],
    ['See [x](|)', { kind: 'link-url', anchor: false, image: false }],
    ['See [x](#in|)', { kind: 'link-url', anchor: true, typed: '#in' }],
    ['![x](|)', { kind: 'link-url', image: true }],
    ['Text[^|', { kind: 'footnote', typed: '' }],
    ['x <di|', { kind: 'html-tag', typed: '<di', closing: false }],
    ['<div>x</|', { kind: 'html-tag', closing: true }],
    ['<a hr|', { kind: 'html-attr', tag: 'a', typed: 'hr' }],
    ['$\\fr|$', { kind: 'math', typed: '\\fr', display: false }],
    ['$$\n\\al|\n$$', { kind: 'math', typed: '\\al', display: true }],
    ['**b**{|}', { kind: 'attr-key', owner: { type: 'mark' } }],
    ['[span]{|}', { kind: 'attr-key', owner: { type: 'span' } }],
    ['[a](b){|}', { kind: 'attr-key', owner: { type: 'link' } }],
    ['## Title {|}', { kind: 'attr-key', owner: { type: 'heading' } }],
  ] as const)('%j', (src, expected) => {
    expect(at(src)).toMatchObject(expected)
  })

  it.each([
    'plain prose|',
    'Note: text|',
    'http://x.dev|',
    '`::ca|`',
    '    ::ca|',
    '<!-- ::ca| -->',
    'set {x|',
    'a {{ b | c‸}}',
    '::card{title="x"}|',
    '```ts\ncode\n```|',
    '---\ntitle: x\n---|',
  ])('stays quiet in %j', (src) => {
    expect(at(src)).toBeNull()
  })

  it('treats fence bodies as their language (no Comark items)', async () => {
    expect(at('```\n::ca|\n```')).toMatchObject({ kind: 'fence-body', lang: '' })
    expect(await labels('```\n::ca|\n```')).toEqual([])
  })

  it('answers on empty lines and mid-line only when asked', () => {
    expect(at('|')).toBeNull()
    expect(at('|', true)).toMatchObject({ kind: 'block', slash: false })
    expect(at('some te|', true)).toMatchObject({ kind: 'inline', typed: 'te' })
  })

  it('replaces from the start of the typed text', () => {
    const { state, pos } = stateWith('::card{variant="pri|')
    const ctx = resolveContext(state, pos)!
    expect(state.sliceDoc(ctx.from, ctx.to)).toBe('pri')
  })

  it('offers the matching closer', () => {
    expect(at('::card\ntext\n::|')).toMatchObject({ kind: 'component-name', closer: { name: 'card' } })
    expect(at('::card\n:::note\n:::|\n::')).toMatchObject({ closer: { name: 'note' } })
  })
})
