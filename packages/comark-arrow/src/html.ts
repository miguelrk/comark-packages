import type { ElementNode } from 'comark'
import { escapeHtml } from 'comark/utils'
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
 * Static HTML fallback for `ArrowSandbox` nodes (no VM).
 * Use with `createHtmlRenderer({ components: { ArrowSandbox } })`.
 */
export const ArrowSandbox = ([, attrs]: ElementNode): string => {
  const a = attrs as ArrowSandboxAttrs
  const fallback = (a.fallback as ArrowFallback | undefined) ?? 'caption'
  const source = typeof a.source === 'string' ? a.source : ''

  if (fallback === 'source') {
    return `<pre class="arrow-sandbox-fallback arrow-sandbox-source"><code>${escapeHtml(source)}</code></pre>`
  }

  if (fallback === 'placeholder') {
    return `<figure class="arrow-sandbox-fallback arrow-sandbox-placeholder" role="img" aria-label="${escapeHtml(DEFAULT_CAPTION)}"><div class="arrow-sandbox-skeleton"></div></figure>`
  }

  return `<figure class="arrow-sandbox-fallback arrow-sandbox-caption"><figcaption>${escapeHtml(DEFAULT_CAPTION)}</figcaption></figure>`
}
