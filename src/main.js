import './styles/global.css'
import App from './App.svelte'
import { mount } from 'svelte'

// Capture PWA install prompt before any component mounts
window.__pwaInstallPrompt = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__pwaInstallPrompt = e
})

const app = mount(App, { target: document.getElementById('app') })

export default app
