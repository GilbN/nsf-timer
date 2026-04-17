// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { WebSocket as NodeWebSocket } from 'ws'
import { startServer } from '../server/helpers.js'

// SocketHost calls `new WebSocket(...)` from module scope — shim the global.
globalThis.WebSocket = NodeWebSocket

let server
let SocketHost
const importSocketHost = async () => {
  vi.resetModules()
  vi.doMock('../../../src/lib/config.js', () => ({ WS_SERVER_URL: server.url }))
  const mod = await import('../../../src/lib/peer/SocketHost.js')
  return mod.SocketHost
}

beforeAll(async () => {
  server = await startServer({ hostGracePeriod: 1000 })
})
afterAll(async () => { await server.close() })

beforeEach(async () => {
  SocketHost = await importSocketHost()
})

afterEach(() => {
  vi.doUnmock('../../../src/lib/config.js')
})

describe('SocketHost.createRoom', () => {
  it('resolves with a 4-char code on success', async () => {
    const host = new SocketHost()
    const code = await host.createRoom()

    expect(code).toMatch(/^[A-Z2-9]{4}$/)
    expect(host.code).toBe(code)
    host.destroy()
  })

  it('restores an existing room code when passed one (reclaim path)', async () => {
    const host1 = new SocketHost()
    const code = await host1.createRoom()
    // Simulate relay dropping the host — close WS without destroy (keeps grace alive)
    host1._destroyed = true // prevent auto-reconnect from interfering
    host1.ws.close()

    // Wait for server to register the disconnect
    await new Promise(r => setTimeout(r, 50))

    const host2 = new SocketHost()
    const reclaimed = await host2.createRoom(code)
    expect(reclaimed).toBe(code)

    host2.destroy()
  })

  it('retries with a new code when the generated code is already taken', async () => {
    // Occupy a known code, then force SocketHost to collide on the first try.
    const squatter = new SocketHost()
    const taken = await squatter.createRoom()

    const host = new SocketHost()
    // Stub generateCode so the first call returns the taken code, then random
    let calls = 0
    const originalGenerate = host.generateCode.bind(host)
    host.generateCode = vi.fn(() => {
      calls++
      if (calls === 1) return taken
      return originalGenerate()
    })

    const code = await host.createRoom()
    expect(code).not.toBe(taken)
    expect(host.generateCode).toHaveBeenCalledTimes(2)

    host.destroy()
    squatter.destroy()
  })

  it('rejects if the provided code is already taken (no retry when reclaiming)', async () => {
    const squatter = new SocketHost()
    const taken = await squatter.createRoom()

    const host = new SocketHost()
    await expect(host.createRoom(taken)).rejects.toThrow(/code_taken/)

    host.destroy()
    squatter.destroy()
  })
})

describe('SocketHost peer tracking', () => {
  it('records a joining peer in the connections map', async () => {
    const host = new SocketHost()
    await host.createRoom()

    // A bare ws client joins via the relay
    const ws = new NodeWebSocket(server.url)
    await new Promise(r => ws.once('open', r))
    ws.send(JSON.stringify({
      action: 'JOIN_ROOM', code: host.code, name: 'Alice', lane: '1',
    }))

    // Wait for host to see PEER_JOINED
    await vi.waitFor(() => expect(host.connections.size).toBe(1), { timeout: 1000 })

    const entry = [...host.connections.values()][0]
    expect(entry.name).toBe('Alice')
    expect(entry.lane).toBe('1')
    expect(entry.jamsUsed).toBe(0)
    expect(entry.jamStageKeys).toBeInstanceOf(Set)

    ws.close()
    host.destroy()
  })

  it('removes peers on PEER_LEFT', async () => {
    const host = new SocketHost()
    await host.createRoom()

    const ws = new NodeWebSocket(server.url)
    await new Promise(r => ws.once('open', r))
    ws.send(JSON.stringify({ action: 'JOIN_ROOM', code: host.code, name: 'A', lane: '1' }))

    await vi.waitFor(() => expect(host.connections.size).toBe(1))
    ws.close()
    await vi.waitFor(() => expect(host.connections.size).toBe(0))

    host.destroy()
  })

  it('notifies via onPeersChange when peers join/leave', async () => {
    const host = new SocketHost()
    const cb = vi.fn()
    host.onPeersChange(cb)
    await host.createRoom()

    const ws = new NodeWebSocket(server.url)
    await new Promise(r => ws.once('open', r))
    ws.send(JSON.stringify({ action: 'JOIN_ROOM', code: host.code, name: 'A', lane: '1' }))

    // Wait until the callback has been invoked with the populated peers list.
    // _syncRoomState fires at least once on room creation with an empty list,
    // so we specifically wait for the post-PEER_JOINED invocation.
    await vi.waitFor(() => {
      const last = cb.mock.calls.at(-1)?.[0] ?? []
      expect(last.length).toBe(1)
    })
    expect(cb.mock.calls.at(-1)[0][0]).toMatchObject({ name: 'A', lane: '1' })

    ws.close()
    host.destroy()
  })

  it('evicts a stale peer when a new peer takes the same lane', async () => {
    const host = new SocketHost()
    await host.createRoom()

    // Simulate a stale entry that the server already evicted but the host missed
    host.connections.set('peer-stale', {
      name: 'Ghost', lane: '1', jamsUsed: 0, jamStageKeys: new Set(),
    })

    const ws = new NodeWebSocket(server.url)
    await new Promise(r => ws.once('open', r))
    ws.send(JSON.stringify({ action: 'JOIN_ROOM', code: host.code, name: 'A', lane: '1' }))

    await vi.waitFor(() => {
      expect(host.connections.has('peer-stale')).toBe(false)
      expect(host.connections.size).toBe(1)
    })

    ws.close()
    host.destroy()
  })
})

describe('SocketHost jam tracking', () => {
  let host
  beforeEach(async () => {
    host = new SocketHost()
    await host.createRoom()
    // Seed a peer entry directly (no real client needed for these pure-logic checks)
    host.connections.set('peer-A', {
      name: 'Alice', lane: '1', jamsUsed: 0, jamStageKeys: new Set(),
    })
  })
  afterEach(() => host?.destroy())

  it('allows up to 2 jams per peer per program', () => {
    expect(host.canPeerDeclareJam('peer-A', 'stage0')).toBe(true)
    expect(host.recordJam('peer-A', 'stage0')).toBe(true)
    expect(host.canPeerDeclareJam('peer-A', 'stage1')).toBe(true)
    expect(host.recordJam('peer-A', 'stage1')).toBe(true)
    // Third is rejected
    expect(host.canPeerDeclareJam('peer-A', 'stage2')).toBe(false)
    expect(host.recordJam('peer-A', 'stage2')).toBe(false)
  })

  it('allows at most 1 jam per stage per peer', () => {
    expect(host.recordJam('peer-A', 'stage0')).toBe(true)
    expect(host.canPeerDeclareJam('peer-A', 'stage0')).toBe(false)
    expect(host.recordJam('peer-A', 'stage0')).toBe(false)
  })

  it('rejects jams from unknown peerIds', () => {
    expect(host.canPeerDeclareJam('peer-ghost', 'stage0')).toBe(false)
    expect(host.recordJam('peer-ghost', 'stage0')).toBe(false)
  })

  it('resetAllJams clears state for every peer', () => {
    host.connections.set('peer-B', {
      name: 'Bob', lane: '2', jamsUsed: 2, jamStageKeys: new Set(['stage0', 'stage1']),
    })

    host.recordJam('peer-A', 'stage0')
    host.resetAllJams()

    for (const entry of host.connections.values()) {
      expect(entry.jamsUsed).toBe(0)
      expect(entry.jamStageKeys.size).toBe(0)
    }
  })
})

describe('SocketHost PEERS_SNAPSHOT handling', () => {
  it('rebuilds connections from a snapshot, preserving jam state for matching peerIds', async () => {
    const host = new SocketHost()
    await host.createRoom()

    // Pre-populate with a peer that has used a jam
    host.connections.set('peer-A', {
      name: 'Alice', lane: '1', jamsUsed: 1, jamStageKeys: new Set(['stage0']),
    })
    host.connections.set('peer-stale', {
      name: 'Ghost', lane: '9', jamsUsed: 0, jamStageKeys: new Set(),
    })

    // Simulate a server snapshot (as if we just reclaimed)
    host._handleEnvelope({
      action: 'PEERS_SNAPSHOT',
      peers: [
        { peerId: 'peer-A', name: 'Alice', lane: '1' },
        { peerId: 'peer-B', name: 'Bob', lane: '2' },
      ],
    })

    expect(host.connections.has('peer-stale')).toBe(false)
    expect(host.connections.has('peer-B')).toBe(true)
    // Jam state for peer-A should be preserved across the snapshot
    const a = host.connections.get('peer-A')
    expect(a.jamsUsed).toBe(1)
    expect(a.jamStageKeys.has('stage0')).toBe(true)

    host.destroy()
  })
})

describe('SocketHost.getPeerDetails', () => {
  it('sorts peers by lane then by name', async () => {
    const host = new SocketHost()
    await host.createRoom()
    host.connections.set('p3', { name: 'Charlie', lane: '2', jamsUsed: 0, jamStageKeys: new Set() })
    host.connections.set('p1', { name: 'Alice', lane: '1', jamsUsed: 0, jamStageKeys: new Set() })
    host.connections.set('p2', { name: 'Bob', lane: '2', jamsUsed: 0, jamStageKeys: new Set() })

    const peers = host.getPeerDetails()
    expect(peers.map(p => p.peerId)).toEqual(['p1', 'p2', 'p3'])

    host.destroy()
  })

  it('sets canJam=false when the peer has used both jams', async () => {
    const host = new SocketHost()
    await host.createRoom()
    host.connections.set('p1', {
      name: 'A', lane: '1', jamsUsed: 2, jamStageKeys: new Set(['stage0', 'stage1']),
    })
    host.connections.set('p2', {
      name: 'B', lane: '2', jamsUsed: 0, jamStageKeys: new Set(),
    })

    const peers = host.getPeerDetails('stage2')
    const p1 = peers.find(p => p.peerId === 'p1')
    const p2 = peers.find(p => p.peerId === 'p2')
    expect(p1.canJam).toBe(false)
    expect(p2.canJam).toBe(true)

    host.destroy()
  })

  it('sets canJam=false for the current stage when the peer already jammed on it', async () => {
    const host = new SocketHost()
    await host.createRoom()
    host.connections.set('p1', {
      name: 'A', lane: '1', jamsUsed: 1, jamStageKeys: new Set(['stage0']),
    })

    const peers = host.getPeerDetails('stage0')
    expect(peers[0].canJam).toBe(false)

    const peersOther = host.getPeerDetails('stage1')
    expect(peersOther[0].canJam).toBe(true)

    host.destroy()
  })
})
