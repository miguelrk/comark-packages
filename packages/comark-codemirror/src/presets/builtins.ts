/**
 * All of comark's built-in plugins (on top of the defaults).
 */
import type { EditorPlugin } from '../types.ts'
import binding from '../plugins/binding.ts'
import breaks from '../plugins/breaks.ts'
import codeBlocks from '../plugins/code-blocks.ts'
import emoji from '../plugins/emoji.ts'
import footnotes from '../plugins/footnotes.ts'
import headings from '../plugins/headings.ts'
import jsonRender from '../plugins/json-render.ts'
import math from '../plugins/math.ts'
import mermaid from '../plugins/mermaid.ts'
import model from '../plugins/model.ts'
import punctuation from '../plugins/punctuation.ts'
import security from '../plugins/security.ts'
import summary from '../plugins/summary.ts'
import toc from '../plugins/toc.ts'
import twoslash from '../plugins/twoslash.ts'

/** Built-ins. `rangi` and `shiki` (fence language lists from optional peers) are added separately. */
export const presetBuiltins = (): EditorPlugin[] => [
  binding(), breaks(), codeBlocks(), emoji(), footnotes(), headings(), jsonRender(), math(), mermaid(), model(), punctuation(), security(), summary(), toc(), twoslash(),
]

export default presetBuiltins
