import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./tests/setup/setup.js'],
    include: ['tests/**/*.test.js'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.js', 'server/**/*.js'],
      exclude: ['src/main.js', 'src/**/*.svelte'],
    },
  },
})
