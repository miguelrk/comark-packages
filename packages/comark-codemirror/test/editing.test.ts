import type { Edit } from '../src/index.ts'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { diagnose, hoverAt, insertComponent, propsToYaml, setFrontmatter, setHeading, setProps, toggleList, toggleMark, toggleTask, unwrapComponent, wrapComponent, formatTable } from '../src/index.ts'
import { comarkCommands } from '../src/commands/keymap.ts'
import { insertFootnote } from '../src/plugins/footnotes.ts'
import { applyPunctuation } from '../src/plugins/punctuation.ts'
import { stateWith } from './helpers.ts'

/** Apply an edit and return the text. */
function run(src: string, edit: (s: EditorState) => Edit, anchor?: number): string {
  const { state } = stateWith(src)
  const s = anchor === undefined ? state : state.update({ selection: { anchor } }).state
  const result = edit(s)
  if (!result.ok) throw new Error(result.message)
  return s.update({ changes: result.changes }).state.doc.toString()
}

describe('commands', () => {
  it('toggles marks around the selection or the word at the cursor', () => {
    const { state } = stateWith('hello wor|ld')
    const on = toggleMark(state, 'bold')
    expect(on.ok && state.update({ changes: on.changes }).state.doc.toString()).toBe('hello **world**')
    expect(run('**hello**|', s => toggleMark(s.update({ selection: { anchor: 2, head: 7 } }).state, 'bold'))).toBe('hello')
  })

  it('sets headings and toggles lists and tasks', () => {
    expect(run('Title|', s => setHeading(s, 2))).toBe('## Title')
    expect(run('## Title|', s => setHeading(s, 0))).toBe('Title')
    expect(run('a|', s => toggleList(s, 'task'))).toBe('- [ ] a')
    expect(run('- [ ] a|', s => toggleTask(s))).toBe('- [x] a')
  })

  it('inserts, wraps, unwraps components and edits their props', () => {
    expect(run('|', s => insertComponent(s, 'card', { props: { title: 'Hi' } }))).toBe('::card{title="Hi"}\n\n::')
    expect(run('::card\n|\n::', s => insertComponent(s, 'note'))).toBe('::card\n:::note\n\n:::\n::')
    expect(run('Body|', s => wrapComponent(s.update({ selection: { anchor: 0, head: 4 } }).state, 'card'))).toBe('::card\nBody\n::')
    expect(run('::card\n:::note\nx\n:::\n::|', s => wrapComponent(s.update({ selection: { anchor: 0, head: s.doc.length } }).state, 'outer')))
      .toBe('::::outer\n::card\n:::note\nx\n:::\n::\n::::')
    expect(run('::card{title="A"}\nBody|\n::', unwrapComponent)).toBe('Body')
    expect(run('::card{title="A"}\nBody|\n::', s => setProps(s, { title: null, variant: 'ghost' }))).toBe('::card{variant="ghost"}\nBody\n::')
    expect(run('::card\nBody|\n::', s => setProps(s, { flat: true }))).toBe('::card{flat}\nBody\n::')
    expect(run('::card{title="A" flat}\nBody|\n::', propsToYaml)).toBe('::card\n---\ntitle: A\nflat: true\n---\nBody\n::')
  })

  it('edits frontmatter', () => {
    expect(run('# Doc|', s => setFrontmatter(s, 'title', 'Hi'))).toBe('---\ntitle: Hi\n---\n\n# Doc')
    expect(run('---\ntitle: A\n---\n|', s => setFrontmatter(s, 'title', 'B'))).toBe('---\ntitle: B\n---\n')
    expect(run('---\ntitle: A\n---\n|', s => setFrontmatter(s, 'draft', true))).toBe('---\ntitle: A\ndraft: true\n---\n')
    expect(run('---\ntitle: A\ndraft: true\n---\n|', s => setFrontmatter(s, 'draft', null))).toBe('---\ntitle: A\n---\n')
  })

  it('formats tables, footnotes and punctuation', () => {
    expect(run('‸| a | bb |\n|-|-|\n| ccc | d |', formatTable, 2)).toBe('| a   | bb  |\n| --- | --- |\n| ccc | d   |')
    expect(run('See|', s => insertFootnote(s, 'Source'))).toBe('See[^1]\n\n[^1]: Source')
    expect(run('"Hi" -- it\'s `"code"`...|', applyPunctuation)).toBe('“Hi” – it’s `"code"`…')
  })

  it('closes a component on Enter at the end of its opener', () => {
    const { state } = stateWith('::card{title="x"}|')
    let text = ''
    expect(comarkCommands.insertComponentCloser({ state, dispatch: tr => (text = tr.newDoc.toString()) })).toBe(true)
    expect(text).toBe('::card{title="x"}\n\n::')
    const closed = stateWith('::card|\n::').state
    expect(comarkCommands.insertComponentCloser({ state: closed, dispatch: () => {} })).toBe(false)
  })
})

describe('lint', () => {
  const messages = (src: string, options = {}) => diagnose(stateWith(src, options).state).map(d => `${d.source}: ${d.message}`)

  it('reports structure', () => {
    expect(messages('::card{title="x"}\ntext')).toContain('component: `::card` is not closed.')
    expect(messages('```js\ncode')).toContain('fence: Code fence is not closed.')
    expect(messages('---\ntitle: x')).toContain('frontmatter: Frontmatter has no closing `---`.')
    expect(messages('text\n::')).toContain('components: This closer has no matching opener.')
  })

  it('checks the manifest with suggestions', () => {
    const out = messages('::crad\n::\n::card{titel="x" variant="red"}\n#fotoer\n::')
    expect(out).toEqual(expect.arrayContaining([
      'components: Unknown component `crad`. Did you mean `card`?',
      'components: `card` has no prop `titel`. Did you mean `title`?',
      'components: `variant` must be one of `primary`, `ghost`.',
      'components: `card` needs `title`.',
      'components: `card` has no slot `#fotoer`. Did you mean `#footer`?',
    ]))
  })

  it('checks binding paths against the live frontmatter and writable roots', () => {
    const out = messages('---\ntitle: T\n---\n{{ frontmatter.titel }} {{ $doc.x }}\n::card{title="x" ::value="frontmatter.title"}\n::')
    expect(out).toContain('binding: `frontmatter.titel` does not exist. Did you mean `title`?')
    expect(out.some(m => m.includes('$doc'))).toBe(false)
    expect(out.some(m => m.startsWith('model: `frontmatter` is not writable'))).toBe(true)
  })

  it('runs plugin checks', () => {
    const out = messages('A[^1] and [x](#nope)\n\n[^2]: unused\n\n<script>x</script>')
    expect(out).toEqual(expect.arrayContaining([
      'footnotes: Footnote `[^1]` has no definition.',
      'footnotes: Footnote `[^2]` is never referenced.',
      'headings: No heading with id `nope`.',
      'security: `<script>` is removed by the security plugin.',
    ]))
    expect(messages('---\ndraft: x\n---', { frontmatterSchema: { required: ['title'], properties: { title: { type: 'string' }, draft: { enum: ['yes', 'no'] } } } }))
      .toEqual(expect.arrayContaining(['frontmatter: Frontmatter needs `title`.', 'frontmatter: `draft` must be one of `yes`, `no`.']))
  })
})

describe('hover', () => {
  const hover = (src: string, options = {}) => {
    const { state, pos } = stateWith(src, options)
    return hoverAt(state, pos)
  }
  it('documents components and props', () => {
    expect(hover('::ca|rd{title="x"}\n::')!.info).toMatchObject({ title: '::card', description: 'A card' })
    expect(hover('::card{var|iant="ghost"}\n::')!.info).toMatchObject({ title: 'variant' })
  })
  it('shows binding values, footnotes and anchors', () => {
    expect(hover('---\nsite:\n  name: Blog\n---\n{{ frontmatter.site.na|me }}')!.info).toMatchObject({ title: 'frontmatter.site.name', value: 'Blog' })
    expect(hover('A[^|1]\n\n[^1]: The note')!.info).toMatchObject({ description: 'The note' })
    expect(hover('# Intro\n[x](#in|tro)')!.info).toMatchObject({ title: '# Intro' })
  })
})
