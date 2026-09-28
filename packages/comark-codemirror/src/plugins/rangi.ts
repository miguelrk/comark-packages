/**
 * Rangi: fence languages rangi can highlight (rangi is an optional peer,
 * loaded on first use). comark's rangi plugin highlights them when rendering.
 */
import type { Item } from '../types.ts'
import { definePlugin } from '../plugins.ts'

let list: Promise<string[]> | undefined
const load = () => (list ??= import('rangi/languages').then(m => Object.keys((m as { languages: object }).languages)).catch(() => []))

export default definePlugin(() => ({
  name: 'rangi',
  completions: [{
    kinds: ['fence-lang'],
    provide: async (): Promise<Item[]> => (await load()).map(lang => ({ label: lang, type: 'language', section: 'Rangi' })),
  }],
  llms: 'Fenced code is syntax highlighted by language with rangi.',
}))
