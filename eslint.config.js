import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'

export default [
  { ignores: ['dist/', 'coverage/', 'dev-dist/', 'node_modules/', 'server/node_modules/'] },
  js.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['server/**/*.js', 'scripts/**/*.js', '*.config.js', 'tests/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Svelte compiles *.svelte.test.js files, so runes are allowed there
    files: ['**/*.svelte.test.js'],
    languageOptions: {
      globals: { $state: 'readonly', $derived: 'readonly', $effect: 'readonly', $props: 'readonly' },
    },
  },
]
