/**
 * Shiki: fence languages Shiki bundles (shiki is an optional peer, loaded on
 * first use). comark's shiki plugin highlights them when rendering.
 */
import type { Item } from '../types.ts'
import { definePlugin } from '../plugins.ts'

let list: Promise<string[]> | undefined
const load = () => (list ??= import('shiki').then(m => Object.keys((m as { bundledLanguages: object }).bundledLanguages)).catch(() => []))

export default definePlugin(() => ({
  name: 'shiki',
  completions: [{
    kinds: ['fence-lang'],
    provide: async (): Promise<Item[]> => (await load()).map(lang => ({ label: lang, type: 'language', section: 'Shiki' })),
  }],
  llms: 'Fenced code is syntax highlighted by language with Shiki.',
}))
