/**
 * The Comark keymap: thin wrappers that run commands on the view's state.
 */
import type { EditorState, Transaction } from '@codemirror/state'
import type { KeyBinding } from '@codemirror/view'
import type { Edit } from '../types.ts'
import { formatTable, insertComponentCloser, insertLink, setHeading, toggleList, toggleMark, toggleQuote, toggleTask } from './index.ts'

type Target = { state: EditorState, dispatch: (tr: Transaction) => void }

/** Turn an edit function into a CodeMirror command. */
export function toCommand(edit: (state: EditorState) => Edit, userEvent = 'input') {
  return (target: Target): boolean => {
    const result = edit(target.state)
    if (!result.ok) return false
    target.dispatch(target.state.update({ changes: result.changes, selection: result.selection, scrollIntoView: true, userEvent }))
    return true
  }
}

export const comarkCommands = {
  toggleBold: toCommand(s => toggleMark(s, 'bold')),
  toggleItalic: toCommand(s => toggleMark(s, 'italic')),
  toggleCode: toCommand(s => toggleMark(s, 'code')),
  toggleStrike: toCommand(s => toggleMark(s, 'strike')),
  setHeading: (level: number) => toCommand(s => setHeading(s, level)),
  toggleBulletList: toCommand(s => toggleList(s, 'bullet')),
  toggleOrderedList: toCommand(s => toggleList(s, 'ordered')),
  toggleTaskList: toCommand(s => toggleList(s, 'task')),
  toggleTask: toCommand(s => toggleTask(s)),
  toggleQuote: toCommand(toggleQuote),
  insertLink: toCommand(s => insertLink(s)),
  formatTable: toCommand(formatTable),
  insertComponentCloser: toCommand(insertComponentCloser),
}

export const comarkKeymap: readonly KeyBinding[] = [
  { key: 'Mod-b', run: comarkCommands.toggleBold },
  { key: 'Mod-i', run: comarkCommands.toggleItalic },
  { key: 'Mod-Shift-c', run: comarkCommands.toggleCode },
  { key: 'Mod-Shift-x', run: comarkCommands.toggleStrike },
  { key: 'Mod-k', run: comarkCommands.insertLink },
  { key: 'Mod-Shift-u', run: comarkCommands.toggleBulletList },
  { key: 'Mod-Shift-o', run: comarkCommands.toggleOrderedList },
  { key: 'Mod-Shift-t', run: comarkCommands.toggleTaskList },
  { key: 'Mod-Enter', run: comarkCommands.toggleTask },
  { key: 'Mod-Shift-q', run: comarkCommands.toggleQuote },
  { key: 'Mod-Alt-f', run: comarkCommands.formatTable },
  // Enter at the end of a component opener adds the body line and the closer
  { key: 'Enter', run: comarkCommands.insertComponentCloser },
  ...[0, 1, 2, 3, 4, 5, 6].map(level => ({ key: `Mod-Alt-${level}`, run: comarkCommands.setHeading(level) })),
]
