import { describe, it, expect } from 'vitest'
import { get } from 'svelte/store'
import { confirmAction, confirmRequest } from '../../src/lib/confirm.js'

describe('confirmAction', () => {
  it('resolves with the answer given to the open request', async () => {
    const answer = confirmAction('Delete?', 'Delete')
    const request = get(confirmRequest)
    expect(request?.message).toBe('Delete?')
    expect(request?.confirmLabel).toBe('Delete')
    confirmRequest.set(null)
    request?.resolve(true)
    await expect(answer).resolves.toBe(true)
  })

  it('cancels an earlier request when a new one opens', async () => {
    const first = confirmAction('First?')
    const second = confirmAction('Second?')
    await expect(first).resolves.toBe(false)
    expect(get(confirmRequest)?.message).toBe('Second?')
    get(confirmRequest)?.resolve(false)
    confirmRequest.set(null)
    await expect(second).resolves.toBe(false)
  })
})
