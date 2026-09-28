/**
 * Alerts (default): GitHub-style `> [!TYPE]` callouts.
 */
import type { Item } from '../types.ts'
import { definePlugin } from '../plugins.ts'

export const ALERT_TYPES = {
  NOTE: { glyph: 'ℹ️', description: 'Useful information' },
  TIP: { glyph: '💡', description: 'Helpful advice' },
  IMPORTANT: { glyph: '❗', description: 'Key information' },
  WARNING: { glyph: '⚠️', description: 'Needs attention' },
  CAUTION: { glyph: '🛑', description: 'Risks or negative outcomes' },
} as const

export interface AlertOptions {
  /** Alert types offered by completion. */
  types?: readonly string[]
}

export default definePlugin<AlertOptions>((options = {}) => {
  const types = options.types ?? Object.keys(ALERT_TYPES)
  const meta = (t: string) => ALERT_TYPES[t as keyof typeof ALERT_TYPES]
  return {
    name: 'alert',
    completions: [{
      kinds: ['alert'],
      provide: (): Item[] => types.map(t => ({ label: `[!${t}]`, insert: `[!${t}]\n> $0`, detail: meta(t)?.description ?? 'alert', glyph: meta(t)?.glyph, type: 'alert' })),
    }],
    snippets: types.map(t => ({ label: t[0] + t.slice(1).toLowerCase(), insert: `> [!${t}]\n> $0`, detail: `> [!${t}]`, section: 'Callouts', type: 'alert' })),
    llms: `Alerts: a blockquote whose first line is \`[!TYPE]\` with TYPE one of ${types.join(', ')}.\n\n\`\`\`md\n> [!TIP]\n> Helpful advice.\n\`\`\``,
  }
})
