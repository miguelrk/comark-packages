/**
 * Punctuation: comark renders typographic quotes, dashes and ellipses.
 * `applyPunctuation` writes them into the source (prose only).
 */
import type { EditorState } from '@codemirror/state'
import type { Edit } from '../types.ts'
import { noop } from '../commands/index.ts'
import { docIndex } from '../document/index.ts'
import { definePlugin } from '../plugins.ts'

export function typographic(text: string): string {
  return text
    .replace(/(^|[\s([{])"(?=\S)/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s([{])'(?=\S)/g, '$1‘')
    .replace(/(\w)'(\w)/g, '$1’$2')
    .replace(/'/g, '’')
    .replace(/---/g, '—')
    .replace(/(?<!-)--(?!-)/g, '–')
    .replace(/\.\.\./g, '…')
}

/** Typographic punctuation in the selected lines (or the whole document), outside code, attributes, links and components. */
export function applyPunctuation(state: EditorState): Edit {
  const index = docIndex(state)
  const range = state.selection.main
  const [a, b] = range.empty ? [1, state.doc.lines] : [state.doc.lineAt(range.from).number, state.doc.lineAt(range.to).number]
  const regions = index.outline.filter(n => n.kind === 'fence' || n.kind === 'math' || n.kind === 'frontmatter')
  const changes: { from: number, to: number, insert: string }[] = []
  for (let n = a; n <= b; n++) {
    if (regions.some(r => n >= r.line && n <= r.endLine)) continue
    const line = state.doc.line(n)
    if (/^\s*(?::{2,}|#[A-Za-z]|<|\||---)/.test(line.text)) continue
    // prose = the text outside code spans, attribute blocks, bindings, links' URLs, HTML tags and math
    const protectedRe = /`[^`]*`|\{[^}]*\}|\]\([^)]*\)|<[^>]*>|\$[^$]*\$|(?<![\w:]):[A-Za-z][\w-]*/g
    let cursor = 0
    for (const m of [...line.text.matchAll(protectedRe), { index: line.text.length, 0: '' } as RegExpMatchArray]) {
      const text = line.text.slice(cursor, m.index)
      const next = typographic(text)
      if (next !== text) changes.push({ from: line.from + cursor, to: line.from + m.index!, insert: next })
      cursor = m.index! + m[0].length
    }
  }
  return changes.length ? { ok: true, changes } : noop('Nothing to change.')
}

export default definePlugin(() => ({
  name: 'punctuation',
  commands: [{
    name: 'applyPunctuation',
    description: 'Replace straight quotes, `--`, `---` and `...` with typographic characters in prose (selection, or the whole document).',
    run: state => applyPunctuation(state),
  }],
  llms: 'Straight quotes, `--`, `---` and `...` render as typographic characters; plain ASCII is fine.',
}))
