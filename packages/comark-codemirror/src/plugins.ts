/**
 * Plugin definition and resolution (comark/Vite/UnoCSS conventions): plain
 * objects from factories, deduped by name (a later plugin replaces an earlier
 * one), then ordered by `enforce`.
 */
import type { ComponentDef, EditorPlugin } from './types.ts'

/** Define a plugin factory (typed options in, plugin object out). */
export function definePlugin<O = void>(factory: (options?: O) => EditorPlugin): (options?: O) => EditorPlugin {
  return factory
}

/** Identity helper that types a component manifest. */
export function defineComponents<const T extends readonly ComponentDef[]>(components: T): T {
  return components
}

export function resolvePlugins(plugins: readonly EditorPlugin[]): EditorPlugin[] {
  const byName = new Map<string, EditorPlugin>()
  for (const plugin of plugins) {
    byName.delete(plugin.name)
    byName.set(plugin.name, plugin)
  }
  const list = [...byName.values()]
  const rank = (p: EditorPlugin) => (p.enforce === 'pre' ? 0 : p.enforce === 'post' ? 2 : 1)
  return list.map((p, i) => [p, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([p]) => p)
}
