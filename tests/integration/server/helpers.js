// Shared helpers for spinning up an isolated relay server per test and driving
// it with ws-library clients. Every test gets its own port and its own set of
// 4-char room codes, so they can safely run in parallel.

import { WebSocket } from 'ws'
import { createServer } from '../../../server/index.js'

/**
 * Start a relay server on an ephemeral port. Returns helpers for getting the
 * port and tearing the server down.
 */
export async function startServer(opts = {}) {
  const instance = createServer({ port: 0, ...opts }) // 0 = kernel picks a free port
  // Wait until the underlying net.Server has actually bound
  await new Promise((resolve, reject) => {
    instance.wss.on('listening', resolve)
    instance.wss.on('error', reject)
  })
  const { port } = instance.wss.address()
  return {
    port,
    url: `ws://127.0.0.1:${port}`,
    close: () => instance.close(),
  }
}

/**
 * Open a WebSocket and wait until it is OPEN. Rejects on any early error.
 */
export function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const onError = (err) => {
      ws.off('open', onOpen)
      reject(err)
    }
    const onOpen = () => {
      ws.off('error', onError)
      resolve(wrap(ws))
    }
    ws.once('open', onOpen)
    ws.once('error', onError)
  })
}

/**
 * Wrap a raw ws with an async message queue + convenience helpers.
 *
 * Why a queue rather than a .on('message') callback? Tests need to assert the
 * order of messages synchronously (e.g. "ROOM_CREATED" then "PEERS_SNAPSHOT")
 * and `await next()` makes that ordering explicit without racing the event
 * loop. The queue buffers any messages that arrive before a waiter is ready.
 */
function wrap(ws) {
  const buffered = []
  const waiters = []

  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data) } catch { return }
    if (waiters.length) waiters.shift()(msg)
    else buffered.push(msg)
  })

  return {
    raw: ws,

    send(obj) {
      ws.send(JSON.stringify(obj))
    },

    /**
     * Wait for the next message. Times out with a helpful error so a hung
     * test doesn't just stall — it fails fast.
     */
    next(timeoutMs = 1000) {
      return new Promise((resolve, reject) => {
        if (buffered.length) return resolve(buffered.shift())
        const t = setTimeout(() => {
          const idx = waiters.indexOf(handler)
          if (idx >= 0) waiters.splice(idx, 1)
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for next message`))
        }, timeoutMs)
        const handler = (msg) => {
          clearTimeout(t)
          resolve(msg)
        }
        waiters.push(handler)
      })
    },

    /**
     * Wait for a specific action, skipping (but preserving in the buffer)
     * anything else. Useful when the test doesn't care about incidental
     * traffic.
     */
    async waitFor(action, timeoutMs = 1000) {
      const deadline = Date.now() + timeoutMs
      while (true) {
        const remaining = deadline - Date.now()
        if (remaining <= 0) throw new Error(`Timed out waiting for ${action}`)
        const msg = await this.next(remaining)
        if (msg.action === action) return msg
      }
    },

    close() {
      return new Promise((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) return resolve()
        ws.once('close', resolve)
        ws.close()
      })
    },
  }
}

/**
 * Create a 4-char uppercase code that avoids ambiguous characters and the
 * digits/letters the real app blocks. Using random codes keeps tests from
 * stepping on each other's rooms in the shared module-level registry.
 */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function randomCode() {
  let code = ''
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

/**
 * Promote a freshly connected socket to a host and wait for confirmation.
 */
export async function createHost(url, code = randomCode()) {
  const ws = await connect(url)
  ws.send({ action: 'CREATE_ROOM', code })
  const ack = await ws.next()
  if (ack.action !== 'ROOM_CREATED') {
    throw new Error(`CREATE_ROOM failed: ${JSON.stringify(ack)}`)
  }
  return { ws, code }
}

/**
 * Connect and join as a client (or spectator).
 */
export async function joinClient(url, code, { name = 'Tester', lane = '', role = 'client' } = {}) {
  const ws = await connect(url)
  ws.send({ action: 'JOIN_ROOM', code, name, lane, role })
  const ack = await ws.next()
  if (ack.action === 'ERROR') {
    await ws.close()
    const err = new Error(`JOIN_ROOM rejected: ${ack.reason}`)
    err.reason = ack.reason
    throw err
  }
  if (ack.action !== 'JOINED') {
    throw new Error(`Expected JOINED, got ${JSON.stringify(ack)}`)
  }
  return { ws, peerId: ack.peerId }
}
