/**
 * Cursor contexts: where the cursor is, in terms of what can be completed.
 * `resolveContext()` returns one of these; providers are registered by `kind`.
 */
import type { AttrPrefix } from '../document/attributes.ts'
import type { OutlineNode } from '../document/outline.ts'

interface Base {
  /** Start of the text the completion replaces. */
  from: number
  to: number
  /** Text typed so far (`state.sliceDoc(from, pos)`). */
  typed: string
  pos: number
  /** 1-based line. */
  line: number
  /** Open components around the cursor, outermost first. */
  stack: readonly OutlineNode[]
}

/** Who owns an attribute block. */
export type AttrOwner =
  | { type: 'component', name: string, inline: boolean, node?: OutlineNode }
  | { type: 'slot', name: string, component?: OutlineNode }
  | { type: 'span' | 'link' | 'image' | 'mark' | 'heading' | 'code' }

export type BindingMode = 'interpolation' | 'bound' | 'model'

export type CursorContext =
  | Base & { kind: 'block', slash: boolean }
  | Base & { kind: 'component-name', inline: boolean, colons: number, closer?: OutlineNode }
  | Base & { kind: 'attr-key', owner: AttrOwner, prefix: AttrPrefix, present: readonly string[], separated: boolean }
  | Base & { kind: 'attr-value', owner: AttrOwner, key: string, name: string, present: readonly string[] }
  | Base & { kind: 'attr-class', owner: AttrOwner, present: readonly string[] }
  | Base & { kind: 'attr-id', owner: AttrOwner, present: readonly string[] }
  | Base & { kind: 'binding-path', mode: BindingMode, segments: readonly string[], owner?: AttrOwner, key?: string }
  | Base & { kind: 'binding-default', path: string }
  | Base & { kind: 'slot', component: OutlineNode }
  | Base & { kind: 'props-key', component: OutlineNode, path: readonly string[], present: readonly string[] }
  | Base & { kind: 'props-value', component: OutlineNode, path: readonly string[], key: string }
  | Base & { kind: 'frontmatter-key', path: readonly string[], present: readonly string[] }
  | Base & { kind: 'frontmatter-value', path: readonly string[], key: string }
  | Base & { kind: 'fence-lang' }
  | Base & { kind: 'fence-meta', lang: string }
  | Base & { kind: 'fence-body', lang: string }
  | Base & { kind: 'emoji' }
  | Base & { kind: 'link-url', image: boolean, anchor: boolean }
  | Base & { kind: 'footnote' }
  | Base & { kind: 'alert' }
  | Base & { kind: 'task' }
  | Base & { kind: 'html-tag', closing: boolean }
  | Base & { kind: 'html-attr', tag: string }
  | Base & { kind: 'math', display: boolean }
  | Base & { kind: 'inline' }

export type ContextKind = CursorContext['kind']

export type ContextOf<K extends ContextKind> = Extract<CursorContext, { kind: K }>
