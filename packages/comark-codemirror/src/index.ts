/**
 * comark-codemirror: a Comark code editor for CodeMirror 6.
 *
 * ```ts
 * import { basicSetup, EditorView } from 'codemirror'
 * import { comark } from 'comark-codemirror'
 *
 * new EditorView({ parent, doc, extensions: [basicSetup, comark({ components })] })
 * ```
 */
export { comark } from './setup.ts'
export { definePlugin, defineComponents, resolvePlugins } from './plugins.ts'
export { comarkConfig, configOf, resolveConfig } from './config.ts'

// syntax
export { comarkHighlight, comarkHighlightStyle, comarkLanguage, comarkMarkdown, comarkTags } from './language.ts'
export type { ComarkLanguageOptions } from './language.ts'
export { comarkTheme } from './theme.ts'

// structure
export { docIndex } from './document/index.ts'
export type { DocIndex, Footnote, Heading } from './document/index.ts'
export { outline, slugify } from './document/outline.ts'
export type { OutlineKind, OutlineNode } from './document/outline.ts'
export { formatAttributes, parseAttributes, scanAttributes } from './document/attributes.ts'
export type { AttrEntry, AttrToken } from './document/attributes.ts'
export { parseYaml } from './document/yaml.ts'

// completion
export { resolveContext } from './context/resolve.ts'
export type { AttrOwner, BindingMode, ContextKind, ContextOf, CursorContext } from './context/types.ts'
export { breadcrumb, collect, comarkCompletionSource, complete } from './complete/engine.ts'
export type { CompleteItem } from './complete/engine.ts'
export { chainBackCommand, chainSteps } from './complete/chain.ts'
export { scopesAt, shapeAt, shapeFromSchema, shapeOf } from './bindings.ts'

// editing
export { formatTable, insertComponent, insertLink, propsToYaml, setFrontmatter, setHeading, setProps, toggleList, toggleMark, toggleQuote, toggleTask, unwrapComponent, wrapComponent } from './commands/index.ts'
export type { MarkName } from './commands/index.ts'
export { comarkCommands, comarkKeymap, toCommand } from './commands/keymap.ts'
export { diagnose } from './lint.ts'
export { hoverAt } from './hover.ts'

export type * from './types.ts'
