# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Production build (outputs to dist/)
npm run preview   # Preview production build locally
```

No test runner or linter is configured.

## Architecture Overview

OPK Timer is a **Svelte 5 + Vite PWA** for running synchronized NSF 25m shooting competition timers across multiple devices via peer-to-peer networking (PeerJS).

### Host/Client model

The app uses a strict host/client topology:

- **Host** creates a room with a 4-character code (e.g. `ABCD`), owns the `TimerScheduler`, and broadcasts state to all clients.
- **Clients** join by code, receive timer state via P2P sync, and display it. Clients cannot control the timer.
- PeerJS peer IDs use the prefix `opk-timer-` + room code. Room codes avoid ambiguous characters (no O, 0, I, 1, L).

Global singletons `window.__opkHost` (PeerHost) and `window.__opkClient` (PeerClient) hold the active connection. These are set in `App.svelte` during session creation or restore.

### State flow

1. `TimerScheduler` (host-only) drives the countdown via `TimerEngine` and updates the `timerState` Svelte store.
2. `TimerScheduler.onStateChange` callback triggers `PeerHost.broadcastState(state)`, which sends `STATE_SYNC` messages to all clients.
3. Clients receive messages in `PeerClient._handleMessage` and write directly to the `timerState` store.
4. All Svelte components read from `timerState` (and other stores in `src/lib/stores.js`) reactively.

### View routing

`currentView` store in `stores.js` drives routing — no router library. Views: `home` → `lobby` → `timer` (or `stopwatch` as a standalone mode). `App.svelte` renders the matching view component.

### Key files

| File | Purpose |
|---|---|
| `src/lib/stores.js` | Global Svelte stores: `currentView`, `roomState`, `timerState`, `preferences`, `formattedTime` |
| `src/lib/timer/TimerScheduler.js` | Orchestrates the full competition flow (loading → shooting → stopped, duel cycles, reshoot logic) |
| `src/lib/timer/TimerEngine.js` | Low-level countdown using `requestAnimationFrame` |
| `src/lib/peer/PeerHost.js` | WebRTC host: room creation, client connections, jam tracking, broadcasting |
| `src/lib/peer/PeerClient.js` | WebRTC client: joining, auto-reconnect, receiving state |
| `src/lib/peer/messages.js` | Message type constants (`MSG`) and `createMessage` factory |
| `src/lib/programs/registry.js` | Built-in NSF programs + custom program lookup from localStorage |
| `src/lib/storage.js` | localStorage wrappers for persisting timer state, room state, preferences, custom programs |
| `src/lib/i18n.js` | Norwegian/English translations as a derived Svelte store (`t`) |

### Program structure

Programs (defined in `registry.js`) have `stages[]` → `exercises[]`. Each exercise has `seriesCount`, `shotsPerSeries`, `timePerSeries`, and `loadingTime`. Duel stages also have `targetVisibleTime`, `targetHiddenTime`, and `shotsPerShowing`. Custom programs are stored in localStorage under key `opk-timer-custom-programs`.

### Session persistence

On page load, `App.svelte` calls `restoreSession()` which reads `localStorage` for room and timer state and attempts to reconnect or reclaim the host's room code. All localStorage keys are prefixed with `opk-timer-`.

### Malfunction (jam) rules

Max 2 malfunctions per program per peer, max 1 per stage. Tracked in `PeerHost` per connection entry (`jamsUsed`, `jamStageKeys`). Reset on program reset via `PeerHost.resetAllJams()`.
