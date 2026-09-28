/**
 * Emoji: `:shortcode:` with the glyph in the menu. The same set as comark's
 * emoji plugin (the data is loaded on first use).
 */
import type { CompletionProvider, Item, ProviderContext } from '../types.ts'
import { definePlugin } from '../plugins.ts'

export interface EmojiOptions {
  /** Extra shortcodes, e.g. `{ shipit: '🐿️' }` (same as comark's `extend`). */
  extend?: Readonly<Record<string, string>>
}

let data: Promise<Readonly<Record<string, string>>> | undefined
const load = () => (data ??= import('./emoji-data.ts').then(m => m.EMOJI))

export default definePlugin<EmojiOptions>((options = {}) => {
  const provider: CompletionProvider<any> = {
    kinds: ['component-name', 'emoji'],
    async provide(ctx: ProviderContext<'component-name' | 'emoji'>) {
      const { context } = ctx
      if (context.kind === 'component-name' && !context.inline) return null
      // quiet: a bare `:` lists inline components only; emoji start after two characters
      if (context.typed.length < 3 && !ctx.explicit) return null
      const map = { ...(await load()), ...options.extend }
      return Object.entries(map).map(([name, glyph]): Item => ({ label: `:${name}:`, glyph, type: 'emoji', section: 'Emoji' }))
    },
  }
  return {
    name: 'emoji',
    completions: [provider],
    llms: 'Emoji shortcodes: `:rocket:`, `:tada:`, `:+1:`.',
  }
})
