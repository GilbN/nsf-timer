// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, createHost, joinClient } from './helpers.js'

describe('relay server — message fan-out', () => {
  let server

  beforeAll(async () => { server = await startServer() })
  afterAll(async () => { await server.close() })

  describe('host → clients broadcast', () => {
    it('fans a RELAY from the host out to every client', async () => {
      const host = await createHost(server.url)
      const alice = await joinClient(server.url, host.code, { name: 'Alice', lane: '1' })
      const bob = await joinClient(server.url, host.code, { name: 'Bob', lane: '2' })
      await host.ws.waitFor('PEER_JOINED')
      await host.ws.waitFor('PEER_JOINED')

      const payload = { type: 'STATE_SYNC', payload: { phase: 'loading' }, ts: 1 }
      host.ws.send({ action: 'RELAY', message: payload })

      const [aMsg, bMsg] = await Promise.all([
        alice.ws.waitFor('RELAYED'),
        bob.ws.waitFor('RELAYED'),
      ])
      expect(aMsg.message).toEqual(payload)
      expect(bMsg.message).toEqual(payload)

      await alice.ws.close()
      await bob.ws.close()
      await host.ws.close()
    })

    it('caches STATE_SYNC so late-joining clients get it as CACHED_STATE', async () => {
      const host = await createHost(server.url)
      const state = { type: 'STATE_SYNC', payload: { phase: 'shooting' }, ts: 42 }
      host.ws.send({ action: 'RELAY', message: state })

      // Small wait so the server has definitely processed the RELAY before we join
      await new Promise(r => setTimeout(r, 50))

      const late = await joinClient(server.url, host.code, { name: 'Late', lane: '1' })
      const cached = await late.ws.waitFor('CACHED_STATE')
      expect(cached.message).toEqual(state)

      await late.ws.close()
      await host.ws.close()
    })

    it('does not cache non-STATE_SYNC messages', async () => {
      const host = await createHost(server.url)
      host.ws.send({ action: 'RELAY', message: { type: 'BEEP', payload: {}, ts: 1 } })
      await new Promise(r => setTimeout(r, 50))

      const late = await joinClient(server.url, host.code, { name: 'Late', lane: '1' })
      // No CACHED_STATE expected
      await expect(late.ws.next(200)).rejects.toThrow(/Timed out/)

      await late.ws.close()
      await host.ws.close()
    })
  })

  describe('client → host relay', () => {
    it('forwards a non-spectator client RELAY to the host only', async () => {
      const host = await createHost(server.url)
      const alice = await joinClient(server.url, host.code, { name: 'Alice', lane: '1' })
      const bob = await joinClient(server.url, host.code, { name: 'Bob', lane: '2' })
      await host.ws.waitFor('PEER_JOINED')
      await host.ws.waitFor('PEER_JOINED')

      const msg = { type: 'REPORT_JAM', payload: { peerId: 'x' }, ts: 1 }
      alice.ws.send({ action: 'RELAY', message: msg })

      const forwarded = await host.ws.waitFor('RELAYED')
      expect(forwarded.message).toEqual(msg)

      // Bob (another client) must NOT receive it — this is host-only traffic
      await expect(bob.ws.next(200)).rejects.toThrow(/Timed out/)

      await alice.ws.close()
      await bob.ws.close()
      await host.ws.close()
    })

    it('drops traffic from spectators (read-only role)', async () => {
      const host = await createHost(server.url)
      const spectator = await joinClient(server.url, host.code, {
        name: 'Eve', lane: '1', role: 'spectator',
      })

      spectator.ws.send({ action: 'RELAY', message: { type: 'TRY', payload: {}, ts: 1 } })
      // Host should not see anything from a spectator
      await expect(host.ws.next(200)).rejects.toThrow(/Timed out/)

      await spectator.ws.close()
      await host.ws.close()
    })
  })

  describe('RELAY_TO (host → specific peer)', () => {
    it('delivers to only the addressed peer', async () => {
      const host = await createHost(server.url)
      const alice = await joinClient(server.url, host.code, { name: 'Alice', lane: '1' })
      const bob = await joinClient(server.url, host.code, { name: 'Bob', lane: '2' })
      await host.ws.waitFor('PEER_JOINED')
      await host.ws.waitFor('PEER_JOINED')

      const msg = { type: 'RESHOOT', payload: {}, ts: 1 }
      host.ws.send({ action: 'RELAY_TO', peerId: alice.peerId, message: msg })

      const received = await alice.ws.waitFor('RELAYED')
      expect(received.message).toEqual(msg)

      // Bob must not receive it
      await expect(bob.ws.next(200)).rejects.toThrow(/Timed out/)

      await alice.ws.close()
      await bob.ws.close()
      await host.ws.close()
    })

    it('silently drops when the target peerId is unknown', async () => {
      const host = await createHost(server.url)
      const alice = await joinClient(server.url, host.code, { name: 'Alice', lane: '1' })
      await host.ws.waitFor('PEER_JOINED')

      host.ws.send({ action: 'RELAY_TO', peerId: 'peer-bogus', message: { type: 'X', ts: 1 } })
      await expect(alice.ws.next(200)).rejects.toThrow(/Timed out/)

      await alice.ws.close()
      await host.ws.close()
    })

    it('is ignored when sent by a client (host-only action)', async () => {
      const host = await createHost(server.url)
      const alice = await joinClient(server.url, host.code, { name: 'Alice', lane: '1' })
      const bob = await joinClient(server.url, host.code, { name: 'Bob', lane: '2' })
      await host.ws.waitFor('PEER_JOINED')
      await host.ws.waitFor('PEER_JOINED')

      alice.ws.send({ action: 'RELAY_TO', peerId: bob.peerId, message: { type: 'X', ts: 1 } })
      await expect(bob.ws.next(200)).rejects.toThrow(/Timed out/)

      await alice.ws.close()
      await bob.ws.close()
      await host.ws.close()
    })
  })
})
