import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const wsPort = env.WS_PORT || '8080'
  return {
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: env.VITE_BASE_PATH || '/',
  server: command === 'serve' ? {
    https: env.VITE_HTTPS === 'true',
    host: true,
    proxy: {
      '/ws': { target: `ws://localhost:${wsPort}`, ws: true },
    },
  } : undefined,
  plugins: [
    ...(command === 'serve' ? [basicSsl()] : []),
    tailwindcss(),
    svelte(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'NSF Timer',
        short_name: 'NSF Timer',
        description: 'Synchronized timer for NSF 25m shooting competitions',
        theme_color: '#0d0d1a',
        background_color: '#0d0d1a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,mp3,svg}'],
      },
    }),
  ],
  }
})
