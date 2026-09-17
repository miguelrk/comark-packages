/**
 * Vue entry for comark-flint — plugin + `<Flint>` renderer.
 *
 * ```ts
 * import flint, { Flint } from 'comark-flint/vue'
 * // <Markdown :plugins="[flint()]" :components="{ Flint }" />
 * ```
 *
 * React / Svelte companions can follow as `comark-flint/react` etc.
 */

export { default, svgToNodes, parseFenceMeta, resolvePath, assembleSpec } from '../index.ts'
export type { FlintBackend, FlintOutput, FlintConfig, FlintPluginMeta } from '../index.ts'

export { Flint, type FlintProps, type FlintBackendProp } from './Flint.ts'
