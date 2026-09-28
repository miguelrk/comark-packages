/**
 * Breaks: soft line breaks inside paragraphs render as `<br>`.
 */
import { definePlugin } from '../plugins.ts'

export default definePlugin(() => ({
  name: 'breaks',
  llms: 'Line breaks inside a paragraph are kept as `<br>` (no trailing spaces needed).',
}))
