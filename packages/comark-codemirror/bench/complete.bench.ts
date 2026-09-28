/**
 * Completion latency on a 10k-line document: context resolution and the
 * sync part of the source. Budget: < 2 ms per request.
 */
import { EditorState } from '@codemirror/state'
import { bench, describe } from 'vitest'
import { complete, comark, docIndex, resolveContext } from '../src/index.ts'
import { presetBuiltins } from '../src/presets/builtins.ts'

const block = [
  '## Section',
  '',
  'Some **text** with :badge[new]{color="green"} and {{ frontmatter.site.name }}.',
  '',
  '::card{title="Hello" variant="soft"}',
  'Body',
  '#footer',
  'Foot',
  '::',
  '',
]
const doc = `---\ntitle: Bench\nsite:\n  name: Blog\n---\n\n${Array.from({ length: 1000 }, () => block.join('\n')).join('\n')}\n::card{`
const components = [{ name: 'card', kind: 'block' as const, props: { title: { type: 'string' as const }, variant: { enum: ['soft', 'outline'] } } }]
const extensions = comark({ components, plugins: presetBuiltins() })

describe('10k lines', () => {
  // a fresh document version each run (the index is rebuilt, as after an edit)
  let n = 0
  const fresh = () => EditorState.create({ doc: doc.replace('Bench', `Bench ${n++}`), extensions })
  const warm = fresh()

  bench('resolveContext (warm index)', () => {
    resolveContext(warm, warm.doc.length)
  })
  bench('document index rebuild (after an edit)', () => {
    const edited = warm.update({ changes: { from: 10, insert: String(n++) } }).state
    docIndex(edited)
  })
  bench('complete() after an edit', async () => {
    const edited = warm.update({ changes: { from: 10, insert: String(n++) } }).state
    await complete(edited, edited.doc.length)
  })
  bench('complete() (warm)', async () => {
    await complete(warm, warm.doc.length)
  })
})
