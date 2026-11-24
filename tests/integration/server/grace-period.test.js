// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, createHost, joinClient, connect } from './helpers.js'

// Use a short grace period so the expiration test runs quickly. Real timers
// drive the server (it runs on the event loop, not vitest fake timers), so
// keep this tight but long enough that scheduling jitter on slow CI doesn't
// flake the "host can still reclaim" test.
const GRACE_MS = 250

describe('relay server: host grace period', () => {
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

    // Reclaim the same code with a fresh socket inside the grace window
    const reclaim = await connect(server.url)
    reclaim.send({ action: 'CREATE_ROOM', code: host.code, hostToken: host.hostToken })
    const ack = await reclaim.next()
    expect(ack.action).toBe('ROOM_CREATED')
    expect(ack.hostToken).toBe(host.hostToken)

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

    // The room is gone, so the code is free again and CREATE_ROOM makes a
    // new room with a new token, even when the old token is sent.
    const late = await connect(server.url)
    late.send({ action: 'CREATE_ROOM', code: host.code, hostToken: host.hostToken })
    const ack = await late.next()
    expect(ack.action).toBe('ROOM_CREATED')
    expect(ack.hostToken).not.toBe(host.hostToken)

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

  it('rejects a reclaim with a missing or wrong hostToken', async () => {
    const host = await createHost(server.url)
    const client = await joinClient(server.url, host.code, { name: 'A', lane: '1' })
    await host.ws.waitFor('PEER_JOINED')

    await host.ws.close()
    await client.ws.waitFor('HOST_DISCONNECTED')

    const noToken = await connect(server.url)
    noToken.send({ action: 'CREATE_ROOM', code: host.code })
    expect(await noToken.next()).toMatchObject({ action: 'ERROR', reason: 'code_taken' })

    const wrongToken = await connect(server.url)
    wrongToken.send({ action: 'CREATE_ROOM', code: host.code, hostToken: 'not-the-token' })
    expect(await wrongToken.next()).toMatchObject({ action: 'ERROR', reason: 'code_taken' })

    // The room is still waiting for its real host
    const reclaim = await createHost(server.url, host.code, host.hostToken)
    await client.ws.waitFor('HOST_RECONNECTED')

    await noToken.close()
    await wrongToken.close()
    await reclaim.ws.close()
    await client.ws.close()
  })

  it('lets the right token reclaim while the old host socket is still open', async () => {
    const host = await createHost(server.url)
    const client = await joinClient(server.url, host.code, { name: 'Alice', lane: '1' })
    await host.ws.waitFor('PEER_JOINED')

    const oldClosed = new Promise((resolve) => host.ws.raw.once('close', (code) => resolve(code)))

    // Skip the close. A page reload can beat the old socket's close
    const reclaim = await connect(server.url)
    reclaim.send({ action: 'CREATE_ROOM', code: host.code, hostToken: host.hostToken })
    const ack = await reclaim.next()
    expect(ack).toMatchObject({ action: 'ROOM_CREATED', code: host.code, hostToken: host.hostToken })
    const snapshot = await reclaim.waitFor('PEERS_SNAPSHOT')
    expect(snapshot.peers).toEqual([{ peerId: client.peerId, name: 'Alice', lane: '1' }])
    await client.ws.waitFor('HOST_RECONNECTED')

    // The server closes the replaced socket with 4001
    expect(await oldClosed).toBe(4001)

    // Its close must not start a grace period. The client gets no
    // HOST_DISCONNECTED, and traffic from the new host still reaches it.
    await expect(client.ws.next(GRACE_MS + 200)).rejects.toThrow(/Timed out/)
    reclaim.send({ action: 'RELAY', message: { type: 'PING_TEST' } })
    const relayed = await client.ws.waitFor('RELAYED')
    expect(relayed.message.type).toBe('PING_TEST')

    await reclaim.close()
    await client.ws.close()
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
    reclaim.send({ action: 'CREATE_ROOM', code: host.code, hostToken: host.hostToken })
    await reclaim.waitFor('ROOM_CREATED')
    const snapshot = await reclaim.waitFor('PEERS_SNAPSHOT')

    expect(snapshot.peers).toHaveLength(1)
    expect(snapshot.peers[0].peerId).toBe(player.peerId)

    await reclaim.close()
    await player.ws.close()
    await spectator.ws.close()
  })
})
