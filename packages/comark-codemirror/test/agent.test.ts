import type { Edit } from '../src/index.ts'
import type { EditorState, TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { edit, llms, patch, replace, resolveTarget, runCommand, setText, snapshot, tools } from '../src/agent/index.ts'
import { stateWith } from './helpers.ts'

const DOC = [
  '---',
  'title: Guide',
  '---',
  '# Guide',
  '## Install',
  'Run it.',
  '::card{title="A"}',
  'First',
  '#footer',
  'Foot A',
  '::',
  '::card{title="B"}',
  'Second',
  '::',
  '## Use',
  'Done.',
].join('\n')

const apply = (state: EditorState, e: Edit) => {
  if (!e.ok) throw new Error(`${e.code}: ${e.message}`)
  return state.update({ changes: e.changes }).state.doc.toString()
}

describe('agent API', () => {
  const { state } = stateWith(DOC)

  it('resolves structural targets', () => {
    const lines = (t: Parameters<typeof resolveTarget>[1]) => {
      const r = resolveTarget(state, t)
      return 'ok' in r ? r.code : [r.line, r.endLine]
    }
    expect(lines({ section: 'Install' })).toEqual([5, 14])
    expect(lines({ heading: 'use' })).toEqual([15, 15])
    expect(lines({ component: 'card' })).toBe('ambiguous')
    expect(lines({ component: 'card', where: { title: 'B' } })).toEqual([12, 14])
    expect(lines({ component: 'card', index: 0 })).toEqual([7, 11])
    expect(lines({ slot: 'footer' })).toEqual([9, 10])
    expect(lines({ frontmatter: 'title' })).toEqual([2, 2])
    expect(lines({ text: 'Done.' })).toEqual([16, 16])
    expect(lines({ line: 99 })).toBe('not_found')
  })

  it('replaces unique text and reports ambiguity with candidates', () => {
    expect(apply(state, replace(state, { search: 'Run it.', replace: 'Run `pnpm i`.' }))).toContain('Run `pnpm i`.')
    const amb = replace(state, { search: 'card', replace: 'box' })
    expect(amb).toMatchObject({ ok: false, code: 'ambiguous', candidates: [{ line: 7 }, { line: 12 }] })
    expect(apply(state, replace(state, { search: '::card', replace: '::box', all: true }))).not.toContain('::card')
  })

  it('edits inside and around targets', () => {
    expect(apply(state, edit(state, { target: { component: 'card', where: { title: 'B' } }, mode: 'append', content: 'Appended' }))).toContain('Second\nAppended\n::')
    expect(apply(state, edit(state, { target: { component: 'card', index: 1 }, mode: 'prepend', content: 'Top' }))).toContain('::card{title="B"}\nTop\nSecond')
    expect(apply(state, edit(state, { target: { section: 'Use' }, mode: 'replace', content: '## Usage\nNew.' }))).toMatch(/## Usage\nNew\.$/)
    expect(apply(state, edit(state, { target: { heading: 'Guide' }, mode: 'after', content: 'Intro.' }))).toContain('# Guide\nIntro.\n## Install')
  })

  it('applies unified diffs and minimal full rewrites', () => {
    const diff = '@@ -15,2 +15,2 @@\n ## Use\n-Done.\n+Finished.\n'
    expect(apply(state, patch(state, diff))).toMatch(/Finished\.$/)
    expect(patch(state, '@@ -1,1 +1,1 @@\n-nope\n+x\n')).toMatchObject({ ok: false, code: 'conflict' })
    const rewrite = setText(state, DOC.replace('Run it.', 'Go.'))
    expect(rewrite).toMatchObject({ ok: true, changes: { insert: 'Go' } })
  })

  it('runs commands at targets', () => {
    expect(apply(state, runCommand(state, 'setHeading', { level: 3, target: { heading: 'Use' } }))).toContain('### Use')
    expect(runCommand(state, 'nope')).toMatchObject({ ok: false, code: 'unknown_command' })
    expect(apply(state, runCommand(state, 'insertFootnote', { content: 'x' }))).toContain('[^1]: x')
  })

  it('snapshots and documents the syntax', () => {
    const snap = snapshot(state, { around: { heading: 'Use' }, context: 1 })
    expect(snap.text).toBe('14│ ::\n15│ ## Use\n16│ Done.')
    expect(snap.frontmatter).toEqual({ title: 'Guide' })
    expect(snap.outline.find(n => n.kind === 'component')).toMatchObject({ name: 'card', line: 7, endLine: 11 })
    const doc = llms(state)
    expect(doc).toContain('`::card` — A card. Props: `title` (string) required')
    expect(doc).toContain('Bindings: `{{ path }}`')
  })

  it('exposes tools that edit through dispatch and answer "what is valid here?"', async () => {
    let current = stateWith(DOC).state
    const target = { get state() { return current }, dispatch: (spec: TransactionSpec) => { current = current.update(spec).state } }
    const list = tools(target)
    expect(list.map(t => t.name)).toEqual(expect.arrayContaining(['read', 'complete', 'syntax', 'replace', 'edit', 'patch', 'setText', 'toggleMark', 'insertComponent', 'applyPunctuation', 'insertFootnote']))
    const run = (name: string, params: Record<string, unknown>) => list.find(t => t.name === name)!.execute(params)
    expect(await run('replace', { search: 'Done.', replace: 'Ok.' })).toMatchObject({ ok: true })
    expect(current.doc.toString()).toMatch(/Ok\.$/)
    const valid = await run('complete', { line: 7, column: 8 }) as { context: { kind: string }, items: { label: string }[] }
    expect(valid.context.kind).toBe('attr-key')
    expect(valid.items.map(i => i.label)).toContain('variant')
  })
})
