// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, connect, createHost, joinClient, randomCode } from './helpers.js'

describe('relay server — rooms', () => {
  let server

  beforeAll(async () => { server = await startServer() })
  afterAll(async () => { await server.close() })

  describe('CREATE_ROOM', () => {
    it('acknowledges a 4-char code with ROOM_CREATED', async () => {
      const code = randomCode()
      const ws = await connect(server.url)
      ws.send({ action: 'CREATE_ROOM', code })
      const ack = await ws.next()

      expect(ack.action).toBe('ROOM_CREATED')
      expect(ack.code).toBe(code)
      await ws.close()
    })

    it('rejects codes that are not exactly 4 characters', async () => {
      const ws = await connect(server.url)
      ws.send({ action: 'CREATE_ROOM', code: 'AB' })
      const ack = await ws.next()

      expect(ack.action).toBe('ERROR')
      expect(ack.reason).toBe('invalid_code')
      await ws.close()
    })

    it('rejects a CREATE_ROOM with no code', async () => {
      const ws = await connect(server.url)
      ws.send({ action: 'CREATE_ROOM' })
      const ack = await ws.next()

      expect(ack.action).toBe('ERROR')
      expect(ack.reason).toBe('invalid_code')
      await ws.close()
    })

    it('rejects a duplicate code while the original host is active', async () => {
      const code = randomCode()
      const first = await createHost(server.url, code)

      const second = await connect(server.url)
      second.send({ action: 'CREATE_ROOM', code })
      const ack = await second.next()
      expect(ack.action).toBe('ERROR')
      expect(ack.reason).toBe('code_taken')

      await second.close()
      await first.ws.close()
    })
  })

  describe('JOIN_ROOM', () => {
    it('acknowledges a valid join with JOINED + peerId', async () => {
      const host = await createHost(server.url)
      const { ws, peerId } = await joinClient(server.url, host.code, { name: 'Alice', lane: '1' })

      expect(peerId).toMatch(/^peer-/)
      await ws.close()
      await host.ws.close()
    })

    it('rejects joins for rooms that do not exist', async () => {
      const ws = await connect(server.url)
      ws.send({ action: 'JOIN_ROOM', code: 'ZZZZ', name: 'Bob', lane: '1' })
      const ack = await ws.next()

      expect(ack.action).toBe('ERROR')
      expect(ack.reason).toBe('room_not_found')
      await ws.close()
    })

    it('rejects a second client trying to take the same lane', async () => {
      const host = await createHost(server.url)
      const first = await joinClient(server.url, host.code, { name: 'Alice', lane: '1' })

      await expect(joinClient(server.url, host.code, { name: 'Bob', lane: '1' }))
        .rejects.toMatchObject({ reason: 'lane_taken' })

      await first.ws.close()
      await host.ws.close()
    })

    it('allows two clients on different lanes', async () => {
      const host = await createHost(server.url)
      const a = await joinClient(server.url, host.code, { name: 'Alice', lane: '1' })
      const b = await joinClient(server.url, host.code, { name: 'Bob', lane: '2' })

      expect(a.peerId).not.toBe(b.peerId)

      await a.ws.close()
      await b.ws.close()
      await host.ws.close()
    })

    it('notifies the host when a non-spectator peer joins', async () => {
      const host = await createHost(server.url)
      const joinPromise = host.ws.waitFor('PEER_JOINED')
      const client = await joinClient(server.url, host.code, { name: 'Alice', lane: '3' })

      const notice = await joinPromise
      expect(notice.peerId).toBe(client.peerId)
      expect(notice.name).toBe('Alice')
      expect(notice.lane).toBe('3')

      await client.ws.close()
      await host.ws.close()
    })

    it('does not notify the host when a spectator joins (spectators are invisible)', async () => {
      const host = await createHost(server.url)
      const spectator = await joinClient(server.url, host.code, {
        name: 'Watcher', lane: '1', role: 'spectator',
      })

      // Brief window for any incidental PEER_JOINED — should not arrive
      await expect(host.ws.next(200)).rejects.toThrow(/Timed out/)

      await spectator.ws.close()
      await host.ws.close()
    })

    it('lets a spectator join on an already-taken lane (lanes do not apply)', async () => {
      const host = await createHost(server.url)
      const player = await joinClient(server.url, host.code, { name: 'A', lane: '1' })
      const spectator = await joinClient(server.url, host.code, {
        name: 'Watcher', lane: '1', role: 'spectator',
      })

      expect(spectator.peerId).toBeDefined()

      await player.ws.close()
      await spectator.ws.close()
      await host.ws.close()
    })

    it('notifies the host with PEER_LEFT when a client disconnects', async () => {
      const host = await createHost(server.url)
      const client = await joinClient(server.url, host.code, { name: 'A', lane: '1' })
      await host.ws.waitFor('PEER_JOINED')

      await client.ws.close()
      const left = await host.ws.waitFor('PEER_LEFT')
      expect(left.peerId).toBe(client.peerId)

      await host.ws.close()
    })
  })

  describe('CLOSE_ROOM', () => {
    it('notifies every client with ROOM_CLOSED and deletes the room', async () => {
      const host = await createHost(server.url)
      const client = await joinClient(server.url, host.code, { name: 'A', lane: '1' })

      host.ws.send({ action: 'CLOSE_ROOM' })
      const closed = await client.ws.waitFor('RELAYED')
      expect(closed.message.type).toBe('ROOM_CLOSED')

      // Trying to join again fails — room is gone
      await expect(joinClient(server.url, host.code))
        .rejects.toMatchObject({ reason: 'room_not_found' })

      await client.ws.close()
      await host.ws.close()
    })

    it('is a no-op when sent by a non-host', async () => {
      const host = await createHost(server.url)
      const client = await joinClient(server.url, host.code, { name: 'A', lane: '1' })
      // Drain the expected PEER_JOINED before the no-op assertion
      await host.ws.waitFor('PEER_JOINED')

      client.ws.send({ action: 'CLOSE_ROOM' })
      // Host should not receive anything about closure
      await expect(host.ws.next(200)).rejects.toThrow(/Timed out/)

      await client.ws.close()
      await host.ws.close()
    })
  })

  describe('PING', () => {
    it('replies with PONG', async () => {
      const ws = await connect(server.url)
      ws.send({ action: 'PING' })
      const pong = await ws.next()
      expect(pong.action).toBe('PONG')
      await ws.close()
    })
  })

  describe('malformed input', () => {
    it('silently drops non-JSON frames instead of crashing', async () => {
      const ws = await connect(server.url)
      ws.raw.send('not json{{')
      // Follow up with a valid PING — server should still be responsive
      ws.send({ action: 'PING' })
      const pong = await ws.next()
      expect(pong.action).toBe('PONG')
      await ws.close()
    })

    it('ignores unknown actions without responding', async () => {
      const ws = await connect(server.url)
      ws.send({ action: 'NOT_A_REAL_ACTION' })
      // No reply — follow up with PING proves the connection is still live
      ws.send({ action: 'PING' })
      const reply = await ws.next()
      expect(reply.action).toBe('PONG')
      await ws.close()
    })
  })
})
