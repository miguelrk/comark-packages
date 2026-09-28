import type { ComarkOptions, ComponentDef } from '../src/index.ts'
import { EditorState } from '@codemirror/state'
import { comark, complete } from '../src/index.ts'
import { presetBuiltins } from '../src/presets/builtins.ts'
import { presetEcosystem } from '../src/presets/ecosystem.ts'

export const components: ComponentDef[] = [
  {
    name: 'card',
    kind: 'block',
    description: 'A card',
    group: 'Layout',
    props: {
      title: { type: 'string', required: true, description: 'Heading' },
      variant: { enum: ['primary', 'ghost'], default: 'primary' },
      flat: { type: 'boolean' },
      value: { type: 'string', model: true },
    },
    slots: [{ name: 'default' }, { name: 'footer', description: 'Bottom area' }],
    example: '::card{title="Hi"}\nBody\n::',
  },
  { name: 'badge', kind: 'inline', props: { color: { type: 'string' } } },
  { name: 'note', kind: 'block' },
]

/** A state from a document with `|` (or `‸` when the text has pipes) marking the cursor. */
export function stateWith(src: string, options: ComarkOptions = {}): { state: EditorState, pos: number } {
  const marker = src.includes('‸') ? '‸' : '|'
  const pos = src.indexOf(marker)
  const doc = pos < 0 ? src : src.slice(0, pos) + src.slice(pos + 1)
  const state = EditorState.create({
    doc,
    selection: { anchor: Math.max(0, pos) },
    extensions: comark({ components, plugins: [...presetBuiltins(), ...presetEcosystem()], ...options }),
  })
  return { state, pos: Math.max(0, pos) }
}

/** Completion labels at `|`. */
export async function labels(src: string, options?: ComarkOptions & { explicit?: boolean }) {
  const { state, pos } = stateWith(src, options)
  const res = await complete(state, pos, { explicit: options?.explicit })
  return res?.items.map(i => i.label) ?? null
}

export async function completion(src: string, options?: ComarkOptions & { explicit?: boolean }) {
  const { state, pos } = stateWith(src, options)
  return complete(state, pos, { explicit: options?.explicit })
}
