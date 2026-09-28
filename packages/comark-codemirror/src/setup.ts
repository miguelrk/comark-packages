/**
 * `comark()`: one extension that adds Comark to a CodeMirror editor —
 * language, chained autocompletion, keymap, lint, hover and theme.
 *
 * ```ts
 * new EditorView({ parent, doc, extensions: [basicSetup, comark({ components })] })
 * ```
 */
import type { Extension } from '@codemirror/state'
import type { ComarkOptions } from './types.ts'
import type { ComarkCompletion } from './complete/render.ts'
import { autocompletion } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { linter } from '@codemirror/lint'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, hoverTooltip, keymap } from '@codemirror/view'
import { comarkKeymap } from './commands/keymap.ts'
import { chainExtension } from './complete/chain.ts'
import { comarkCompletionSource } from './complete/engine.ts'
import { optionColumns, renderInfo } from './complete/render.ts'
import { comarkConfig, resolveConfig } from './config.ts'
import { hoverAt } from './hover.ts'
import { comarkHighlight, comarkLanguage } from './language.ts'
import { diagnose } from './lint.ts'
import { comarkTheme } from './theme.ts'

const NO_WRAP = new Set(['InlineCode', 'CodeText', 'FencedCode', 'CodeBlock', 'Frontmatter', 'ComponentProps', 'Math', 'MathBlock', 'Attribute'])

/** Typing `*`, `_`, `` ` `` or `~` over a selection wraps it (`~` wraps with `~~`). */
const wrapSelection = EditorView.inputHandler.of((view, from, to, text) => {
  if (from === to || text.length !== 1 || !'*_`~'.includes(text)) return false
  for (let node: ReturnType<ReturnType<typeof syntaxTree>['resolveInner']> | null = syntaxTree(view.state).resolveInner(from, 1); node; node = node.parent) {
    if (NO_WRAP.has(node.name)) return false
  }
  const marker = text === '~' ? '~~' : text
  view.dispatch({
    changes: [{ from, insert: marker }, { from: to, insert: marker }],
    selection: { anchor: from + marker.length, head: to + marker.length },
    userEvent: 'input.type',
  })
  return true
})

export function comark(options: ComarkOptions = {}): Extension {
  const config = resolveConfig(options)
  const codeLanguages = [...(options.codeLanguages ?? []), ...config.plugins.flatMap(p => p.languages ?? [])]
  const extensions: Extension[] = [
    comarkConfig.of(config),
    comarkLanguage({ codeLanguages }),
    comarkHighlight,
    // one source for every Comark context, in every nested language (frontmatter YAML, fences)
    EditorState.languageData.of(() => [{ autocomplete: comarkCompletionSource }]),
    autocompletion({
      activateOnCompletion: completion => !!(completion as ComarkCompletion).chain,
      icons: config.completion.icons,
      addToOptions: optionColumns,
      maxRenderedOptions: config.completion.maxItems,
      tooltipClass: () => 'cm-comark-menu',
    }),
    chainExtension(config),
    wrapSelection,
  ]
  if (options.keymap !== false) extensions.push(Prec.high(keymap.of(comarkKeymap)))
  if (options.lint !== false) extensions.push(linter(view => diagnose(view.state, config), { delay: 300 }))
  if (options.hover !== false) {
    extensions.push(hoverTooltip((view, pos) => {
      const res = hoverAt(view.state, pos, config)
      return res ? { pos: res.from, end: res.to, above: true, create: () => ({ dom: renderInfo(res.info) }) } : null
    }))
  }
  if (options.theme !== false) extensions.push(comarkTheme)
  for (const plugin of config.plugins) {
    if (plugin.keymap) extensions.push(keymap.of(plugin.keymap))
    if (plugin.extensions) extensions.push(plugin.extensions)
  }
  return extensions
}
