/**
 * Conformance of the Lezer grammar and the outline with comark, on comark's
 * own SPEC fixtures: parsing never throws and covers the document, and every
 * top-level block comark reports ends where one of our blocks ends.
 */
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { createMarkdownParser } from 'comark'
import { describe, expect, it } from 'vitest'
import { outline } from '../../src/document/outline.ts'
import { comarkLanguage } from '../../src/language.ts'
import { fixtures } from './fixtures.ts'

const parse = createMarkdownParser({ autoUnwrap: false })

describe('SPEC conformance', () => {
  it('has the fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(200)
  })

  it.each(fixtures)('parses $name', ({ input }) => {
    const state = EditorState.create({ doc: input, extensions: comarkLanguage() })
    const tree = ensureSyntaxTree(state, input.length, 5000)!
    expect(tree.length).toBe(input.length)
  })

  it.each(fixtures)('block boundaries match comark: $name', async ({ name, input }) => {
    const state = EditorState.create({ doc: input, extensions: comarkLanguage() })
    const tree = ensureSyntaxTree(state, input.length, 5000)!
    const ends = new Set<number>()
    const doc = state.doc
    tree.iterate({
      enter(node) {
        if (node.type.isTop) return
        // block-level nodes: children of Document and of container blocks
        if (node.node.parent && (node.node.parent.type.isTop || ['Component', 'Blockquote', 'ListItem', 'BulletList', 'OrderedList'].includes(node.node.parent.name))) {
          ends.add(doc.lineAt(Math.max(node.from, node.to - (doc.sliceString(node.to - 1, node.to) === '\n' ? 1 : 0))).number)
        }
      },
    })
    for (const n of outline(input)) ends.add(n.endLine)
    const ast = await parse(input, { streaming: true })
    const theirs = (ast.nodes as unknown[])
      .filter((n): n is [string, { $?: { line?: number } }] => Array.isArray(n) && typeof n[0] === 'string' && typeof (n[1] as { $?: { line?: number } } | undefined)?.$?.line === 'number')
      .map(([, attrs]) => attrs.$!.line!)
    // comark's container blocks report the line after their closing marker
    expect({ name, missing: theirs.filter(l => !ends.has(l) && !ends.has(l - 1)) }).toEqual({ name, missing: [] })
  })
})
