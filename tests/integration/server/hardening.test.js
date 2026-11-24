// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, connect } from './helpers.js'

describe('relay server: http and limits', () => {
  let server

  beforeAll(async () => { server = await startServer() })
  afterAll(async () => { await server.close() })

  it('answers GET /healthz with 200 ok', async () => {
    const res = await fetch(`${server.httpUrl}/healthz`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('answers other paths with 404', async () => {
    const res = await fetch(`${server.httpUrl}/nope`)
    expect(res.status).toBe(404)
    await res.text()
  })

  it('ignores JSON that is not an object and codes that are not strings', async () => {
    const ws = await connect(server.url)
    ws.raw.send('null')
    ws.raw.send('42')
    ws.send({ action: 'CREATE_ROOM', code: [1, 2, 3, 4] })
    const err = await ws.waitFor('ERROR')
    expect(err.reason).toBe('invalid_code')

    // The server is still up and answering on the same socket
    ws.send({ action: 'PING' })
    await ws.waitFor('PONG')
    await ws.close()
  })

  it('passes only string names and lanes on to the host', async () => {
    const host = await connect(server.url)
    host.send({ action: 'CREATE_ROOM', code: 'NMLN' })
    await host.waitFor('ROOM_CREATED')
    const client = await connect(server.url)
    client.send({ action: 'JOIN_ROOM', code: 'NMLN', name: 5, lane: { x: 1 } })
    await client.waitFor('JOINED')
    const joined = await host.waitFor('PEER_JOINED')
    expect(joined.name).toBe('')
    expect(joined.lane).toBe('')
    await client.close()
    await host.close()
  })

  it('drops messages over the rate limit without closing the socket', async () => {
    const ws = await connect(server.url)
    let pongs = 0
    ws.raw.on('message', (data) => {
      if (JSON.parse(data).action === 'PONG') pongs++
    })

    // Burst is 200, refill is 100/s, so most of a 400 burst is dropped
    for (let i = 0; i < 400; i++) ws.send({ action: 'PING' })
    await new Promise(r => setTimeout(r, 300))

    expect(pongs).toBeGreaterThanOrEqual(200)
    expect(pongs).toBeLessThan(300)
    expect(ws.raw.readyState).toBe(ws.raw.OPEN)

    // The bucket refills, so the socket works again
    await new Promise(r => setTimeout(r, 100))
    const before = pongs
    ws.send({ action: 'PING' })
    await new Promise(r => setTimeout(r, 100))
    expect(pongs).toBe(before + 1)

    await ws.close()
  })

  it('closes a socket that sends a frame over 64 KiB', async () => {
    const ws = await connect(server.url)
    const closed = new Promise((resolve) => ws.raw.once('close', (code) => resolve(code)))
    ws.raw.send('x'.repeat(64 * 1024 + 1))
    expect(await closed).toBe(1009)
  })
})
