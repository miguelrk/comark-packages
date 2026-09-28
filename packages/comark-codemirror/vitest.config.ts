import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const browsers = (process.env.BROWSERS ?? 'chromium').split(',') as ('chromium' | 'firefox' | 'webkit')[]

export default defineConfig({
  // pre-bundle CodeMirror once, so parallel browser instances never load two copies of @codemirror/state
  optimizeDeps: {
    include: ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@codemirror/autocomplete', '@codemirror/commands', '@codemirror/lint', '@codemirror/lang-markdown', '@codemirror/lang-yaml', '@lezer/common', '@lezer/highlight', '@lezer/markdown'],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['test/**/*.test.ts'],
          exclude: ['test/browser/**'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: browsers.map(browser => ({ browser })),
          },
        },
      },
    ],
    benchmark: { include: ['bench/**/*.bench.ts'] },
  },
})
