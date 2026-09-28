/**
 * comark-packages plugins: etiket, email, flint, page-break and vega.
 */
import type { EditorPlugin } from '../types.ts'
import email from '../plugins/email.ts'
import etiket from '../plugins/etiket.ts'
import flint from '../plugins/flint.ts'
import pageBreak from '../plugins/page-break.ts'
import vega from '../plugins/vega.ts'

export const presetEcosystem = (): EditorPlugin[] => [email(), etiket(), flint(), pageBreak(), vega()]

export default presetEcosystem
