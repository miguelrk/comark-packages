/**
 * Vue entry for comark-arrow — plugin + `<ArrowSandbox>` renderer.
 *
 * ```ts
 * import arrow, { ArrowSandbox, provideArrowHostBridge } from 'comark-arrow/vue'
 * // <Markdown :plugins="[arrow()]" :components="{ ArrowSandbox }" />
 * ```
 */

export {
  default,
  parseFenceMeta,
  searchProps,
  normalizeArrowAttrs,
  resolvePath,
  hasUnclosedArrowFence,
  ARROW_TAG,
  ARROW_DIRECTIVE,
  ARROW_FENCE,
  ARROW_CSS_FENCE,
} from '../index.ts'
export type {
  ArrowConfig,
  ArrowFallback,
  ArrowStatus,
  ArrowSandboxAttrs,
  ArrowPluginMeta,
} from '../index.ts'

export {
  ArrowSandbox,
  provideArrowHostBridge,
  ARROW_HOST_BRIDGE_KEY,
} from './ArrowSandbox.ts'
export type {
  ArrowSandboxProps,
  HostBridge,
  HostBridgeFn,
  HostBridgeModule,
} from './ArrowSandbox.ts'
