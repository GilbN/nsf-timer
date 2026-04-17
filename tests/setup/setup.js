import { vi, beforeEach } from 'vitest'

// happy-dom does not implement AudioContext. Stub it so audio.js can
// import and be called without throwing.
class MockAudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0 }
  resume() { this.state = 'running' }
  createOscillator() {
    return {
      type: '', frequency: { value: 0 },
      connect() {}, start() {}, stop() {},
    }
  }
  createGain() {
    return {
      gain: { value: 0, exponentialRampToValueAtTime() {} },
      connect() {},
    }
  }
  createBuffer() { return {} }
  createBufferSource() {
    return { buffer: null, connect() {}, start() {} }
  }
  get destination() { return {} }
}

globalThis.AudioContext = MockAudioContext
if (typeof window !== 'undefined') {
  window.AudioContext = MockAudioContext
  window.webkitAudioContext = MockAudioContext
}

// Vibrate is optional — silence it so tests don't log warnings.
if (typeof navigator !== 'undefined' && !navigator.vibrate) {
  Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn(() => true),
    writable: true,
    configurable: true,
  })
}

// Reset localStorage between tests so storage tests never leak.
beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
})
