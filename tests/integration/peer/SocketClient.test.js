// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { WebSocket as NodeWebSocket } from 'ws'
import { get } from 'svelte/store'
import { startServer, createHost } from '../server/helpers.js'

globalThis.WebSocket = NodeWebSocket

let server
let SocketClient
let timerState
let roomState
let MSG

const importClient = async () => {
  vi.resetModules()
  vi.doMock('../../../src/lib/config.js', () => ({ WS_SERVER_URL: server.url }))
  SocketClient = (await import('../../../src/lib/peer/SocketClient.js')).SocketClient
  const stores = await import('../../../src/lib/stores.js')
  timerState = stores.timerState
  roomState = stores.roomState
  MSG = (await import('../../../src/lib/peer/messages.js')).MSG
}

beforeAll(async () => {
  server = await startServer({ hostGracePeriod: 500 })
})
afterAll(async () => { await server.close() })

beforeEach(async () => { await importClient() })
afterEach(() => { vi.doUnmock('../../../src/lib/config.js') })

describe('SocketClient.joinRoom', () => {
  it('resolves on successful JOINED and marks roomState.isHost=false', async () => {
    const host = await createHost(server.url)

    const client = new SocketClient()
    const code = await client.joinRoom(host.code, { name: 'Alice', lane: '1' })
    expect(code).toBe(host.code)
    expect(get(roomState).code).toBe(host.code)
    expect(get(roomState).isHost).toBe(false)

    client.destroy()
    await host.ws.close()
  })

  it('rejects when the room does not exist', async () => {
    const client = new SocketClient()
    await expect(client.joinRoom('ZZZZ', { name: 'A', lane: '1' }))
      .rejects.toThrow(/room_not_found/)
  })

  it('rejects with laneRejected when the lane is taken', async () => {
    const host = await createHost(server.url)
    const existing = new SocketClient()
    await existing.joinRoom(host.code, { name: 'A', lane: '1' })

    const client = new SocketClient()
    await expect(client.joinRoom(host.code, { name: 'B', lane: '1' }))
      .rejects.toThrow(/laneRejected/)

    existing.destroy()
    await host.ws.close()
  })

  it('emits a "laneRejected" status before rejecting', async () => {
    const host = await createHost(server.url)
    const existing = new SocketClient()
    await existing.joinRoom(host.code, { name: 'A', lane: '1' })

    const client = new SocketClient()
    const statuses = []
    client.onStatusChange((s) => statuses.push(s))

    await client.joinRoom(host.code, { name: 'B', lane: '1' }).catch(() => {})
    expect(statuses).toContain('laneRejected')

    existing.destroy()
    await host.ws.close()
  })

  it('uppercases the room code before joining', async () => {
    const host = await createHost(server.url)
    const client = new SocketClient()
    // Pass lowercase — client should uppercase internally
    await client.joinRoom(host.code.toLowerCase(), { name: 'A', lane: '1' })
    expect(client.code).toBe(host.code)
    client.destroy()
    await host.ws.close()
  })

  it('emits "connected" status once joined', async () => {
    const host = await createHost(server.url)
    const client = new SocketClient()
    const statuses = []
    client.onStatusChange((s) => statuses.push(s))

    await client.joinRoom(host.code, { name: 'A', lane: '1' })
    expect(statuses).toContain('connected')

    client.destroy()
    await host.ws.close()
  })

  it('marks roomState.isSpectator when joining with role=spectator', async () => {
    const host = await createHost(server.url)
    const client = new SocketClient()
    await client.joinRoom(host.code, { name: 'W', lane: '', role: 'spectator' })
    expect(get(roomState).isSpectator).toBe(true)

    client.destroy()
    await host.ws.close()
  })
})

describe('SocketClient — receiving RELAY messages', () => {
  it('writes STATE_SYNC payloads into the timerState store', async () => {
    const host = await createHost(server.url)
    const client = new SocketClient()
    await client.joinRoom(host.code, { name: 'A', lane: '1' })

    const state = { programId: 'standard', phase: 'loading', stageIndex: 1 }
    host.ws.send({
      action: 'RELAY',
      message: { type: MSG.STATE_SYNC, payload: state, ts: 1 },
    })

    await vi.waitFor(() => {
      expect(get(timerState)).toMatchObject(state)
    })

    client.destroy()
    await host.ws.close()
  })

  it('applies TICK messages as partial updates (remainingMs + targetVisible)', async () => {
    const host = await createHost(server.url)
    const client = new SocketClient()
    await client.joinRoom(host.code, { name: 'A', lane: '1' })

    // Seed a baseline state first
    host.ws.send({
      action: 'RELAY',
      message: { type: MSG.STATE_SYNC, payload: { phase: 'shooting', remainingMs: 1000 }, ts: 1 },
    })
    await vi.waitFor(() => expect(get(timerState).remainingMs).toBe(1000))

    host.ws.send({
      action: 'RELAY',
      message: { type: MSG.TICK, payload: { remainingMs: 500, targetVisible: true }, ts: 2 },
    })

    await vi.waitFor(() => {
      expect(get(timerState).remainingMs).toBe(500)
      expect(get(timerState).targetVisible).toBe(true)
      // TICK should not wipe other fields
      expect(get(timerState).phase).toBe('shooting')
    })

    client.destroy()
    await host.ws.close()
  })

  it('emits "roomClosed" and stops reconnecting when ROOM_CLOSED arrives', async () => {
    const host = await createHost(server.url)
    const client = new SocketClient()
    const statuses = []
    client.onStatusChange((s) => statuses.push(s))

    await client.joinRoom(host.code, { name: 'A', lane: '1' })
    host.ws.send({
      action: 'RELAY',
      message: { type: MSG.ROOM_CLOSED, payload: {}, ts: 1 },
    })

    await vi.waitFor(() => expect(statuses).toContain('roomClosed'))
    expect(client._roomClosed).toBe(true)

    client.destroy()
    await host.ws.close()
  })

  it('treats CACHED_STATE identically to RELAYED — writes to timerState', async () => {
    const host = await createHost(server.url)
    // Seed the cache with STATE_SYNC before client joins
    const state = { programId: 'silhuett', phase: 'idle', stageIndex: 0 }
    host.ws.send({
      action: 'RELAY',
      message: { type: MSG.STATE_SYNC, payload: state, ts: 1 },
    })
    await new Promise(r => setTimeout(r, 50))

    const client = new SocketClient()
    await client.joinRoom(host.code, { name: 'Late', lane: '1' })

    await vi.waitFor(() => expect(get(timerState)).toMatchObject(state))

    client.destroy()
    await host.ws.close()
  })
})

describe('SocketClient host presence', () => {
  it('emits "hostDisconnected" when the host drops', async () => {
    const host = await createHost(server.url)
    const client = new SocketClient()
    const statuses = []
    client.onStatusChange((s) => statuses.push(s))
    await client.joinRoom(host.code, { name: 'A', lane: '1' })

    await host.ws.close()

    await vi.waitFor(() => expect(statuses).toContain('hostDisconnected'))

    client.destroy()
  })

  it('emits "connected" again when the host reclaims within grace', async () => {
    const host = await createHost(server.url)
    const client = new SocketClient()
    const statuses = []
    client.onStatusChange((s) => statuses.push(s))
    await client.joinRoom(host.code, { name: 'A', lane: '1' })

    await host.ws.close()
    await vi.waitFor(() => expect(statuses).toContain('hostDisconnected'))

    // Reclaim
    const reclaim = await createHost(server.url, host.code)
    await vi.waitFor(() => {
      const lastConnected = [...statuses].reverse().indexOf('connected')
      const lastDisconnected = [...statuses].reverse().indexOf('hostDisconnected')
      // A "connected" status arrived AFTER the "hostDisconnected"
      expect(lastConnected).toBeLessThan(lastDisconnected)
    })

    client.destroy()
    await reclaim.ws.close()
  })
})

describe('SocketClient destroy', () => {
  it('stops reconnect attempts and clears roomState', async () => {
    const host = await createHost(server.url)
    const client = new SocketClient()
    await client.joinRoom(host.code, { name: 'A', lane: '1' })

    client.destroy()
    expect(client._destroyed).toBe(true)
    expect(client.ws).toBeNull()
    expect(get(roomState).code).toBeNull()

    await host.ws.close()
  })
})
