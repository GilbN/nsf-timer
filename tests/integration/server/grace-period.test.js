// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, createHost, joinClient, connect } from './helpers.js'

// Use a short grace period so the expiration test runs quickly. Real timers
// drive the server (it runs on the event loop, not vitest fake timers), so
// keep this tight but long enough that scheduling jitter on slow CI doesn't
// flake the "host can still reclaim" test.
const GRACE_MS = 250

describe('relay server — host grace period', () => {
  let server

  beforeAll(async () => { server = await startServer({ hostGracePeriod: GRACE_MS }) })
  afterAll(async () => { await server.close() })

  it('keeps the room alive after host disconnect and notifies clients', async () => {
    const host = await createHost(server.url)
    const client = await joinClient(server.url, host.code, { name: 'A', lane: '1' })
    await host.ws.waitFor('PEER_JOINED')

    await host.ws.close()

    const hostDown = await client.ws.waitFor('HOST_DISCONNECTED')
    expect(hostDown.action).toBe('HOST_DISCONNECTED')

    await client.ws.close()
  })

  it('lets the host reclaim the room within the grace window', async () => {
    const host = await createHost(server.url)
    const client = await joinClient(server.url, host.code, {
      name: 'Alice', lane: '1',
    })
    await host.ws.waitFor('PEER_JOINED')

    await host.ws.close()
    await client.ws.waitFor('HOST_DISCONNECTED')

    // Reclaim the same code with a fresh socket — inside the grace window
    const reclaim = await connect(server.url)
    reclaim.send({ action: 'CREATE_ROOM', code: host.code })
    const ack = await reclaim.next()
    expect(ack.action).toBe('ROOM_CREATED')

    // Host should receive a PEERS_SNAPSHOT with the still-connected client
    const snapshot = await reclaim.waitFor('PEERS_SNAPSHOT')
    expect(snapshot.peers).toHaveLength(1)
    expect(snapshot.peers[0]).toMatchObject({
      peerId: client.peerId, name: 'Alice', lane: '1',
    })

    // Client learns the host is back
    const reconnected = await client.ws.waitFor('HOST_RECONNECTED')
    expect(reconnected.action).toBe('HOST_RECONNECTED')

    await reclaim.close()
    await client.ws.close()
  })

  it('closes the room after the grace period expires', async () => {
    const host = await createHost(server.url)
    const client = await joinClient(server.url, host.code, { name: 'A', lane: '1' })
    await host.ws.waitFor('PEER_JOINED')

    await host.ws.close()
    await client.ws.waitFor('HOST_DISCONNECTED')

    // Wait out the grace period (plus a little buffer for timer drift)
    const closed = await client.ws.waitFor('RELAYED', GRACE_MS + 500)
    expect(closed.message.type).toBe('ROOM_CLOSED')

    // Reclaim attempts should now fail — room is gone
    const late = await connect(server.url)
    late.send({ action: 'CREATE_ROOM', code: host.code })
    const ack = await late.next()
    // Since the room is gone, CREATE_ROOM on that code should succeed as a new room.
    // That's actually the intended behavior — the code is free again.
    expect(ack.action).toBe('ROOM_CREATED')

    await late.close()
    await client.ws.close()
  })

  it('cancels the grace timer when the host explicitly CLOSE_ROOMs', async () => {
    const host = await createHost(server.url)
    const client = await joinClient(server.url, host.code, { name: 'A', lane: '1' })
    await host.ws.waitFor('PEER_JOINED')

    host.ws.send({ action: 'CLOSE_ROOM' })
    const closed = await client.ws.waitFor('RELAYED')
    expect(closed.message.type).toBe('ROOM_CLOSED')

    await client.ws.close()
    await host.ws.close()
  })

  it('excludes spectators from the PEERS_SNAPSHOT on reclaim', async () => {
    const host = await createHost(server.url)
    const player = await joinClient(server.url, host.code, { name: 'P', lane: '1' })
    const spectator = await joinClient(server.url, host.code, {
      name: 'S', lane: '', role: 'spectator',
    })
    await host.ws.waitFor('PEER_JOINED')

    await host.ws.close()
    await player.ws.waitFor('HOST_DISCONNECTED')

    const reclaim = await connect(server.url)
    reclaim.send({ action: 'CREATE_ROOM', code: host.code })
    await reclaim.waitFor('ROOM_CREATED')
    const snapshot = await reclaim.waitFor('PEERS_SNAPSHOT')

    expect(snapshot.peers).toHaveLength(1)
    expect(snapshot.peers[0].peerId).toBe(player.peerId)

    await reclaim.close()
    await player.ws.close()
    await spectator.ws.close()
  })
})
