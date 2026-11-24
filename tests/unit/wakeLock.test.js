import { describe, it, expect, beforeEach, vi } from 'vitest'

function fakeSentinel() {
  const sentinel = { released: false, release: vi.fn(async () => { sentinel.released = true }) }
  return sentinel
}

describe('wakeLock', () => {
  let request
  let mod

  beforeEach(async () => {
    vi.resetModules()
    request = vi.fn(async () => fakeSentinel())
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    mod = await import('../../src/lib/wakeLock.js')
  })

  it('holds a single lock however often acquire is called', async () => {
    await Promise.all([mod.acquireWakeLock(), mod.acquireWakeLock(), mod.acquireWakeLock()])
    await mod.acquireWakeLock()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('asks again after the OS released the lock', async () => {
    await mod.acquireWakeLock()
    const first = await request.mock.results[0].value
    first.released = true
    await mod.acquireWakeLock()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('releases a lock that arrives after release was requested', async () => {
    const pending = mod.acquireWakeLock()
    mod.releaseWakeLock()
    await pending
    const sentinel = await request.mock.results[0].value
    expect(sentinel.release).toHaveBeenCalled()
  })
})
