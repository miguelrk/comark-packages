import type { ElementNode } from 'comark'
import type { ArrowFallback, ArrowSandboxAttrs } from './index.ts'

export {
  default,
  parseFenceMeta,
  searchProps,
  normalizeArrowAttrs,
  resolvePath,
  ARROW_TAG,
  ARROW_DIRECTIVE,
  ARROW_FENCE,
  ARROW_CSS_FENCE,
} from './index.ts'
export type {
  ArrowConfig,
  ArrowFallback,
  ArrowStatus,
  ArrowSandboxAttrs,
  ArrowPluginMeta,
} from './index.ts'

const DEFAULT_CAPTION = 'Interactive widget — view online'

/**
 * Static ANSI fallback for `ArrowSandbox` nodes (no VM).
 */
export const ArrowSandbox = ([, attrs]: ElementNode): string => {
  const a = attrs as ArrowSandboxAttrs
  const fallback = (a.fallback as ArrowFallback | undefined) ?? 'caption'
  const source = typeof a.source === 'string' ? a.source : ''

  if (fallback === 'source' && source) {
    return source + '\n'
  }

  return `[arrow] ${DEFAULT_CAPTION}\n`
}
