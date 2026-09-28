/**
 * comark-pdf page breaks: `::page-break` … `::`.
 */
import type { ComponentDef } from '../types.ts'
import { definePlugin } from '../plugins.ts'

export const pageBreakComponents: ComponentDef[] = [{
  name: 'page-break',
  kind: 'block',
  group: 'PDF',
  description: 'Force a page break in PDF output',
  props: { type: { enum: ['after', 'before'] } },
  example: '::page-break\n::',
}]

export default definePlugin(() => ({
  name: 'page-break',
  components: pageBreakComponents,
  llms: 'Page breaks for PDF output (comark-pdf): `::page-break` and `::` on their own lines.',
}))
