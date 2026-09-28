import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { comarkLanguage } from '../src/language.ts'

/** `Name "text"` for every node, depth-first. */
function nodes(doc: string): string[] {
  const state = EditorState.create({ doc, extensions: comarkLanguage() })
  const out: string[] = []
  ensureSyntaxTree(state, doc.length, 5000)!.iterate({ enter: n => void out.push(`${n.name} ${JSON.stringify(doc.slice(n.from, n.to))}`) })
  return out
}

describe('grammar', () => {
  it('splits attribute blocks into parts', () => {
    expect(nodes('::card{#a .b title="x" :bound="p" flag}\n::').filter(n => n.startsWith('Attr'))).toEqual([
      'Attribute "{#a .b title=\\"x\\" :bound=\\"p\\" flag}"',
      'AttrBrace "{"',
      'AttrId "#a"',
      'AttrClass ".b"',
      'AttrKey "title"',
      'AttrEquals "="',
      'AttrValue "\\"x\\""',
      'AttrKey ":bound"',
      'AttrEquals "="',
      'AttrValue "\\"p\\""',
      'AttrKey "flag"',
      'AttrBrace "}"',
    ])
  })

  it('nests YAML in frontmatter and component props', () => {
    const tree = nodes('---\na: 1\n---\n\n::card\n---\nb: 2\n---\n::')
    // the content nodes are replaced by the mounted YAML trees
    expect(tree.filter(n => n.startsWith('Stream'))).toEqual(['Stream "a: 1"', 'Stream "b: 2"'])
    expect(tree.filter(n => n.startsWith('Pair'))).toEqual(['Pair "a: 1"', 'Pair "b: 2"'])
  })

  it('parses bindings with fallbacks, but not an empty {{}} (like comark)', () => {
    expect(nodes('x {{ a.b || c }}').filter(n => n.startsWith('Binding'))).toEqual([
      'Binding "{{ a.b || c }}"',
      'BindingMark "{{"',
      'BindingPath "a.b"',
      'BindingOperator "||"',
      'BindingDefault "c"',
      'BindingMark "}}"',
    ])
    expect(nodes('x {{}}').some(n => n.startsWith('Binding'))).toBe(false)
  })

  it('closes nested components with the same colon count innermost-first, by indentation', () => {
    const tree = nodes('::outer\n  ::inner\n    text\n  ::\nafter\n::')
    expect(tree.filter(n => n.startsWith('Component '))).toEqual([
      'Component "::outer\\n  ::inner\\n    text\\n  ::\\nafter\\n::"',
      'Component "::inner\\n    text\\n  ::"',
    ])
    expect(tree.some(n => n.startsWith('CodeBlock'))).toBe(false)
  })

  it('parses slots, inline components and emoji apart', () => {
    const tree = nodes('::card\n#footer{unwrap="p"}\n:badge[new]{color="red"} :smile:\n::')
    expect(tree).toEqual(expect.arrayContaining(['SlotName "footer"', 'InlineComponentName "badge"', 'Emoji ":smile:"']))
  })
})
