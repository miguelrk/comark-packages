import { PageBreak as JasyPageBreak, Box } from '@jasy/pdf'
import type { JasyComponentFn } from '../jasy.ts'

/**
 * jasy render function for `::page-break` nodes.
 * type="after" (default) — inserts a page break after.
 * type="before" — inserts a page break before via Box breakBefore.
 */
export const PageBreak: JasyComponentFn = ([, attrs]) => {
  const type = String(attrs.type ?? 'after')
  if (type === 'before') {
    return Box({ breakBefore: true }, [])
  }
  return JasyPageBreak()
}

// No-op parser plugin — `::page-break` is already parsed by the built-in components plugin.
const pageBreak = (): { name: string } => ({ name: 'page-break' })
export default pageBreak
