/**
 * Chained menus. Picking an item with `chain` reopens completion
 * (`activateOnCompletion`) at the next completable spot. While the menu is
 * open: → accepts an item that has a next level, ← undoes the last chained
 * pick and reopens its menu, commit keys (`{`, `=`, `.`) accept the item
 * instead of being typed, and Tab accepts or moves to the next snippet field
 * and opens its menu.
 */
import type { Extension, Text, TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { ResolvedConfig } from '../types.ts'
import type { ComarkCompletion } from './render.ts'
import { acceptCompletion, completionStatus, hasNextSnippetField, nextSnippetField, pickedCompletion, selectedCompletion, startCompletion } from '@codemirror/autocomplete'
import { Annotation, ChangeSet, EditorSelection, Prec, StateField } from '@codemirror/state'
import { EditorView as View, keymap } from '@codemirror/view'

interface Step {
  inverse: ChangeSet
  selection: EditorSelection
  after: Text
}

const chainBack = Annotation.define<boolean>()

/** Chained picks since the last other edit (for ← back). */
export const chainSteps = StateField.define<readonly Step[]>({
  create: () => [],
  update(steps, tr) {
    if (tr.annotation(chainBack)) return steps.slice(0, -1)
    const picked = tr.annotation(pickedCompletion) as ComarkCompletion | undefined
    if (picked?.chain && tr.docChanged) {
      return [...steps.slice(-20), { inverse: tr.changes.invert(tr.startState.doc), selection: tr.startState.selection, after: tr.newDoc }]
    }
    return tr.docChanged ? [] : steps
  },
})

const selected = (view: EditorView) =>
  completionStatus(view.state) === 'active' ? selectedCompletion(view.state) as ComarkCompletion | null : null

/** Undo the last chained pick and reopen its menu. */
export function chainBackCommand(view: EditorView): boolean {
  const step = view.state.field(chainSteps, false)?.at(-1)
  if (!step || step.after !== view.state.doc) return false
  const spec: TransactionSpec = { changes: step.inverse, selection: step.selection, annotations: chainBack.of(true), userEvent: 'undo.complete' }
  view.dispatch(spec)
  startCompletion(view)
  return true
}

export function chainExtension(config: ResolvedConfig): Extension {
  const bindings = [
    {
      key: 'Tab',
      run: (view: EditorView) => {
        if (completionStatus(view.state) === 'active') return acceptCompletion(view)
        if (!hasNextSnippetField(view.state)) return false
        nextSnippetField(view)
        startCompletion(view)
        return true
      },
    },
  ]
  if (config.completion.drill) {
    bindings.push(
      {
        key: 'ArrowRight',
        run: (view: EditorView) => (selected(view)?.item.drill ? acceptCompletion(view) : false),
      },
      {
        key: 'ArrowLeft',
        run: (view: EditorView) => (completionStatus(view.state) === 'active' ? chainBackCommand(view) : false),
      },
    )
  }
  return [
    chainSteps,
    Prec.highest(keymap.of(bindings)),
    Prec.highest(View.domEventHandlers({
      keydown(event, view) {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return false
        const option = selected(view)
        if (!option?.item.commit?.includes(event.key)) return false
        event.preventDefault()
        return acceptCompletion(view)
      },
    })),
  ]
}
