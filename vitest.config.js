import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./tests/setup/setup.js'],
    pool: 'forks',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.js'],
          exclude: ['tests/unit/components/**'],
        },
      },
      {
        // Mounting components needs Svelte's browser build. Kept separate
        // because the 'browser' condition would also pick ws's browser stub.
        extends: true,
        resolve: { conditions: ['browser'] },
        test: {
          name: 'components',
          include: ['tests/unit/components/**/*.test.js'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.js', 'server/**/*.js'],
      exclude: ['src/main.js', 'src/**/*.svelte'],
    },
  },
})
