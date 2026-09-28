/**
 * The resolved configuration lives in a facet, so every part of the editor
 * (completion, lint, hover, agents) reads it from the `EditorState`, with or
 * without a view.
 */
import type { EditorState } from '@codemirror/state'
import type { ComarkOptions, CommandDef, ComponentDef, ResolvedConfig } from './types.ts'
import { Facet } from '@codemirror/state'
import { resolvePlugins } from './plugins.ts'
import { defaultPlugins } from './presets/defaults.ts'

export function resolveConfig(options: ComarkOptions = {}): ResolvedConfig {
  const plugins = resolvePlugins([
    ...(options.registerDefaultPlugins === false ? [] : defaultPlugins()),
    ...(options.plugins ?? []),
  ])
  const components = new Map<string, ComponentDef>()
  for (const def of [...plugins.flatMap(p => p.components ?? []), ...(options.components ?? [])]) {
    const prev = components.get(def.name)
    components.set(def.name, prev ? { ...prev, ...def, props: { ...prev.props, ...def.props } } : def)
  }
  const commands = new Map<string, CommandDef>()
  for (const command of plugins.flatMap(p => p.commands ?? [])) commands.set(command.name, command)
  const fences = [...new Set([
    ...plugins.flatMap(p => p.fences ?? []),
    ...plugins.flatMap(p => p.languages ?? []).flatMap(l => [l.name.toLowerCase(), ...l.alias]),
    ...(options.codeLanguages ?? []).flatMap(l => [l.name.toLowerCase(), ...l.alias]),
  ])]
  return {
    plugins,
    components,
    options,
    commands,
    fences,
    completion: {
      slash: true,
      chain: true,
      drill: true,
      info: 'auto',
      maxItems: 80,
      icons: true,
      ...options.completion,
    },
  }
}

export const comarkConfig = Facet.define<ResolvedConfig, ResolvedConfig | null>({
  combine: values => values[0] ?? null,
})

let fallback: ResolvedConfig | undefined

/** The config of a state set up with `comark()`, or the defaults. */
export function configOf(state: EditorState): ResolvedConfig {
  return state.facet(comarkConfig) ?? (fallback ??= resolveConfig())
}
