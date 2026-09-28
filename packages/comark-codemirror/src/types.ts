/**
 * Public types: the component manifest, binding shapes, completion items,
 * plugins and `comark()` options.
 */
import type { Completion } from '@codemirror/autocomplete'
import type { LanguageDescription } from '@codemirror/language'
import type { Diagnostic } from '@codemirror/lint'
import type { EditorState, Extension, TransactionSpec } from '@codemirror/state'
import type { KeyBinding } from '@codemirror/view'
import type { ContextKind, CursorContext } from './context/types.ts'
import type { DocIndex } from './document/index.ts'

// #region component manifest

export type PropType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'

export interface PropDef {
  type?: PropType
  enum?: readonly (string | number | boolean)[]
  required?: boolean
  default?: unknown
  description?: string
  /** Accepts a one-way `:prop="path"` binding. @default true */
  bindable?: boolean
  /** Accepts a two-way `::prop="path"` binding. @default false */
  model?: boolean
}

export interface SlotDef {
  name: string
  description?: string
}

/**
 * A binding name a component introduces for its children, e.g. the loop
 * variable of `::for{:each="data.posts" item="post"}`.
 */
export interface ScopeDef {
  /** Default binding name. */
  name: string
  /** Prop whose value overrides the name (`item`). */
  nameProp?: string
  /** Prop whose value is the data path this binding points to (`each`). */
  source?: string
  /** The binding is one element of the list at `source`. */
  element?: boolean
  description?: string
}

/** What the editor knows about a component. */
export interface ComponentDef {
  name: string
  kind: 'block' | 'inline' | 'both'
  description?: string
  /** Block menu section. */
  group?: string
  /** Props by name, without `:` / `::` prefixes (binding forms are derived). */
  props?: Readonly<Record<string, PropDef>>
  slots?: readonly SlotDef[]
  /** Allowed child components. Unset means any. */
  children?: readonly string[]
  scope?: readonly ScopeDef[]
  /** A Comark example, shown highlighted in the docs panel. */
  example?: string
  /** Documentation URL. */
  docs?: string
}

// #endregion

// #region bindings

/** JSON Schema subset used for frontmatter, `data` and `meta`. */
export interface JSONSchema {
  type?: string | readonly string[]
  description?: string
  properties?: Readonly<Record<string, JSONSchema>>
  items?: JSONSchema
  enum?: readonly unknown[]
  required?: readonly string[]
  default?: unknown
  [key: string]: unknown
}

/** The known structure of a binding value, from a sample value or a schema. */
export interface Shape {
  type?: PropType | 'null'
  description?: string
  properties?: Record<string, Shape>
  items?: Shape
  enum?: readonly unknown[]
  /** A sample (or the live) value, shown as a preview. */
  value?: unknown
  /** The structure is complete: unknown keys are errors. */
  closed?: boolean
}

/** A binding root such as `frontmatter`, `props`, `data` or a loop variable. */
export interface ScopeRoot {
  name: string
  description?: string
  shape: Shape
  /** Accepts `::prop` two-way bindings. */
  writable?: boolean
}

export interface ScopeContext {
  state: EditorState
  index: DocIndex
  pos: number
}

export type ScopeProvider = (ctx: ScopeContext) => ScopeRoot | readonly ScopeRoot[] | null | undefined

// #endregion

// #region completion

/** The docs panel next to the completion list. */
export interface InfoDocs {
  title?: string
  description?: string
  /** Rows of `[name, type/value, description]`. */
  rows?: readonly (readonly [string, string, string?])[]
  /** Comark source, rendered highlighted. */
  example?: string
  /** A value preview (bindings). */
  value?: unknown
  link?: string
}

/**
 * A completion item. Plain data: the engine turns it into a CodeMirror
 * `Completion`.
 */
export interface Item {
  label: string
  /** Text inserted instead of `label`. `$0` marks the cursor, `${1:text}` adds Tab stops. */
  insert?: string
  detail?: string
  info?: string | InfoDocs
  /** Icon: `component`, `prop`, `slot`, `value`, `binding`, `emoji`, `snippet`, … */
  type?: string
  boost?: number
  /** Section name. Defaults to the context's breadcrumb. */
  section?: string
  /** Reopen the menu after this item is picked (the next step of the chain). */
  chain?: boolean
  /** The item has a next level (→ drills in, and a chevron is shown). */
  drill?: boolean
  /** Keys that accept this item and are swallowed, e.g. `{` on a component. */
  commit?: string
  /** After insertion, step over the closing quote of an attribute value. */
  exit?: boolean
  /** Leading glyph (emoji, math symbol, alert icon). */
  glyph?: string
  /** CSS color shown as a swatch. */
  swatch?: string
  /** Custom apply function (escape hatch). */
  apply?: Completion['apply']
}

export interface ProviderContext<K extends ContextKind = ContextKind> {
  context: Extract<CursorContext, { kind: K }>
  state: EditorState
  index: DocIndex
  config: ResolvedConfig
  explicit: boolean
  /** Binding roots visible at the cursor. */
  scopes: () => ScopeRoot[]
}

export interface CompletionProvider<K extends ContextKind = ContextKind> {
  kinds: readonly K[]
  provide: (ctx: ProviderContext<K>) => readonly Item[] | null | undefined | Promise<readonly Item[] | null | undefined>
}

/** A declarative snippet shown in the block (`/`) or inline menu. */
export interface SnippetDef {
  label: string
  insert: string
  /** @default 'block' */
  context?: 'block' | 'inline'
  section?: string
  detail?: string
  info?: string | InfoDocs
  type?: string
  chain?: boolean
}

// #endregion

// #region lint, hover, commands

export interface LintContext {
  state: EditorState
  index: DocIndex
  config: ResolvedConfig
}

export type LintSource = (ctx: LintContext) => readonly Diagnostic[]

export interface HoverResult {
  from: number
  to: number
  info: string | InfoDocs
}

export type HoverSource = (ctx: LintContext & { pos: number }) => HoverResult | null | undefined

/** A structured failure (tools never throw). */
export interface EditError {
  ok: false
  code: string
  message: string
  candidates?: { line: number, excerpt: string }[]
}

export type Edit = {
  ok: true
  changes: TransactionSpec['changes']
  selection?: TransactionSpec['selection']
} | EditError

export interface CommandDef {
  name: string
  description: string
  params?: JSONSchema
  run: (state: EditorState, params: Record<string, unknown>, config: ResolvedConfig) => Edit
}

// #endregion

// #region plugins and options

export interface EditorPlugin {
  name: string
  enforce?: 'pre' | 'post'
  components?: readonly ComponentDef[]
  scopes?: readonly ScopeProvider[]
  completions?: readonly CompletionProvider<any>[]
  snippets?: readonly SnippetDef[]
  /** Languages for fenced code (highlighting inside fences, `fence-lang` completion). */
  languages?: readonly LanguageDescription[]
  /** Fence languages offered after ```` ``` ```` without a CodeMirror language. */
  fences?: readonly string[]
  lint?: readonly LintSource[]
  hover?: readonly HoverSource[]
  commands?: readonly CommandDef[]
  keymap?: readonly KeyBinding[]
  /** Agent-facing syntax reference (Markdown). */
  llms?: string
  /** CodeMirror escape hatch. */
  extensions?: Extension
}

export interface CompletionOptions {
  /** `/` at the start of a line opens the block menu. @default true */
  slash?: boolean
  /** Reopen the menu after a pick. @default true */
  chain?: boolean
  /** → drills into an item, ← goes back one step. @default true */
  drill?: boolean
  /** Docs panel. @default 'auto' */
  info?: 'auto' | false
  /** @default 80 */
  maxItems?: number
  /** @default true */
  icons?: boolean
}

export interface LinkTarget {
  url: string
  title?: string
  kind?: 'page' | 'asset'
}

export interface ComarkOptions {
  /** Editor plugins. A plugin replaces an earlier one with the same name. */
  plugins?: readonly EditorPlugin[]
  /** Register comark's default plugins (alert, attributes, components, frontmatter, html, task-list). @default true */
  registerDefaultPlugins?: boolean
  /** Component manifest (merged after plugin manifests; later wins). */
  components?: readonly ComponentDef[]
  /** Frontmatter keys and values. */
  frontmatterSchema?: JSONSchema
  /** The `data` binding root: a sample value or `{ schema }`. */
  data?: unknown
  dataSchema?: JSONSchema
  /** The `meta` binding root. */
  meta?: unknown
  metaSchema?: JSONSchema
  /** Pages and assets offered in `[text](…)` and `![alt](…)`. */
  links?: readonly LinkTarget[] | ((query: string) => readonly LinkTarget[] | Promise<readonly LinkTarget[]>)
  /** Languages for fenced code. */
  codeLanguages?: readonly LanguageDescription[]
  completion?: CompletionOptions
  /** Structural and manifest diagnostics. @default true */
  lint?: boolean
  /** Hover docs. @default true */
  hover?: boolean
  /** Comark keymap (marks, headings, lists, component closer). @default true */
  keymap?: boolean
  /** Menu and syntax theme. @default true */
  theme?: boolean
}

export interface ResolvedConfig {
  plugins: readonly EditorPlugin[]
  components: ReadonlyMap<string, ComponentDef>
  options: ComarkOptions
  completion: Required<CompletionOptions>
  /** Plugin commands (the core catalog is added by the agent API). */
  commands: ReadonlyMap<string, CommandDef>
  fences: readonly string[]
}

// #endregion
