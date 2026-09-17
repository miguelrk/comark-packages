import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['test/*.test.ts'],
          exclude: ['test/preview.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['test/preview.test.ts'],
          environment: 'happy-dom',
        },
      },
    ],
  },
})
