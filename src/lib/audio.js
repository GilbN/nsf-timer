let audioContext = null
let soundEnabled = true

export function setSoundEnabled(enabled) {
  soundEnabled = enabled
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  return audioContext
}

function playTone(frequency, duration, type = 'square') {
  if (!soundEnabled) return
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = frequency
    gain.gain.value = 0.3
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Audio not available
  }
}

export function beepStart() {
  playTone(880, 0.15)
}

export function beepStop() {
  playTone(440, 0.3)
}

export function beepTargetUp() {
  playTone(1200, 0.1)
}

export function beepTargetDown() {
  playTone(600, 0.15)
}

// Must be called from a user gesture to unlock audio on mobile
export function unlockAudio() {
  try {
    const ctx = getAudioContext()
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start()
  } catch {
    // ignore
  }
}
