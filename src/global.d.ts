/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injected by vite.config.js from package.json. */
declare const __APP_VERSION__: string

interface Window {
  /** The deferred `beforeinstallprompt` event, captured in main.js. */
  __pwaInstallPrompt: any
  webkitAudioContext?: typeof AudioContext
}

interface Navigator {
  /** iOS Safari: true when launched from the home screen. */
  standalone?: boolean
}
