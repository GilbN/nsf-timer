# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build (outputs to dist/)
npm run preview   # Preview production build locally

# WebSocket relay server (required for multi-device sync)
cd server && npm run dev   # Dev (auto-restart on change)
cd server && npm start     # Production
```

Set `VITE_WS_SERVER_URL=ws://localhost:8080` in `.env.local` for local development (already present).

No test runner or linter is configured.

## Architecture Overview

NSF Timer is a **Svelte 5 + Vite PWA** for running synchronized NSF 25m shooting competition timers across multiple devices via a WebSocket relay server.

### Host/Client model

The app uses a strict host/client topology:

- **Host** creates a room with a 4-character code (e.g. `ABCD`), owns the `TimerScheduler`, and broadcasts state to all clients via the relay server.
- **Clients** join by code, receive timer state via the relay, and display it. Clients cannot control the timer.
- Room codes avoid ambiguous characters (no O, 0, I, 1, L).
- The relay server (`server/index.js`) is stateless except for an in-memory room registry and a cached last `STATE_SYNC` per room for fast reconnection.

Global singletons `window.__nsfHost` (SocketHost), `window.__nsfClient` (SocketClient), and `window.__nsfScheduler` (TimerScheduler) hold the active connection/scheduler. These are set in `App.svelte` during session creation or restore.

### State flow

1. `TimerScheduler` (host-only) drives the countdown via `TimerEngine` and updates the `timerState` Svelte store.
2. `TimerScheduler.onStateChange` callback triggers `SocketHost.broadcastState(state)`, which sends `STATE_SYNC` messages to all clients via the relay.
3. Clients receive messages in `SocketClient._handleMessage` and write directly to the `timerState` store.
4. All Svelte components read from `timerState` (and other stores in `src/lib/stores.js`) reactively.

### View routing

`currentView` store in `stores.js` drives routing — no router library. Views: `home` → `lobby` → `timer` (or `stopwatch` as a standalone mode). `App.svelte` renders the matching view component.

### Key files

| File | Purpose |
|---|---|
| `src/lib/stores.js` | Global Svelte stores: `currentView`, `roomState`, `timerState`, `preferences`, `formattedTime` |
| `src/lib/timer/TimerScheduler.js` | Orchestrates the full competition flow (loading → shooting → stopped, duel cycles, reshoot logic) |
| `src/lib/timer/TimerEngine.js` | Low-level countdown using `requestAnimationFrame` |
| `src/lib/peer/SocketHost.js` | WebSocket host: room creation, client tracking, jam tracking, broadcasting |
| `src/lib/peer/SocketClient.js` | WebSocket client: joining, auto-reconnect, receiving state |
| `server/index.js` | Relay server: room registry, message fanout, STATE_SYNC cache, heartbeat |
| `src/lib/config.js` | `WS_SERVER_URL` — reads `VITE_WS_SERVER_URL` env var |
| `src/lib/peer/messages.js` | Message type constants (`MSG`) and `createMessage` factory |
| `src/lib/programs/registry.js` | Built-in NSF programs + custom program lookup from localStorage |
| `src/lib/storage.js` | localStorage wrappers for persisting timer state, room state, preferences, custom programs |
| `src/lib/i18n.js` | Norwegian/English translations as a derived Svelte store (`t`) |
| `src/lib/audio.js` | Web Audio API tones + vibration: `beepStart`, `beepStop`, `beepTargetUp`, `beepTargetDown`, `unlockAudio` |
| `src/lib/wakeLock.js` | Screen wake lock wrapper (keeps display on during competition) |

### Program structure

Programs (defined in `registry.js`) have `stages[]` → `exercises[]`. Each exercise has `seriesCount`, `shotsPerSeries`, `timePerSeries`, and `loadingTime`. Stages have a `type` field:

- **`precision`**: target visible for the full `timePerSeries`
- **`rapid`**: hidden phase (`targetHiddenTime`) then visible phase (`timePerSeries`)
- **`duell`**: repeated hidden/visible cycles (`targetHiddenTime`/`targetVisibleTime`) with `shotsPerShowing` shots each cycle

Custom programs are stored in localStorage under key `nsf-timer-custom-programs`.

### Session persistence

On page load, `App.svelte` calls `restoreSession()` which reads `localStorage` for room and timer state and attempts to reconnect or reclaim the host's room code. All localStorage keys are prefixed with `nsf-timer-`.

### Malfunction (jam) rules

Max 2 malfunctions per program per peer, max 1 per stage. Tracked in `SocketHost` per connection entry (`jamsUsed`, `jamStageKeys`). Reset on program reset via `SocketHost.resetAllJams()`.
