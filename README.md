# OPK Timer

Synchronized timer for NSF 25m shooting competitions. Built as a Progressive Web App — install it on any phone, tablet, or computer and run competitions across multiple devices with peer-to-peer sync.

## Features

- **Built-in NSF programs** — Fin/Grov Pistol, Standard, Silhouette, NAIS, Rapid Fire with full stage/series timing
- **Custom programs** — Create and save your own competition programs
- **P2P multiplayer** — Host creates a room, shooters join by 4-character code. Timer state syncs in real-time via WebRTC (PeerJS)
- **Precision & Duel modes** — Countdown timers for precision stages, target-up/target-down cycling for duel stages
- **Malfunction handling** — Track jams per shooter (max 2 per program, 1 per stage) with reshoot support
- **Bilingual** — Norwegian and English
- **Offline-capable PWA** — Install to home screen, works without internet after first load
- **Standalone stopwatch** — Simple stopwatch mode independent of the competition system

## How it works

1. **Host** creates a room and selects a shooting program
2. **Shooters** join with the room code, their name, and lane number
3. Host controls the timer — start, pause, stop, reset
4. All connected devices display the synchronized countdown in real-time

## Tech stack

- [Svelte 5](https://svelte.dev/) — UI framework
- [Vite](https://vite.dev/) — Build tool with HMR
- [PeerJS](https://peerjs.com/) — WebRTC peer-to-peer connections
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — Service worker & manifest generation

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |

## Project structure

```
src/
├── App.svelte              # Root component, view routing, session restore
├── views/
│   ├── HomeView.svelte     # Landing page — create/join room, recent rooms
│   ├── LobbyView.svelte    # Host room — program selection, peer list
│   ├── TimerView.svelte    # Active competition — timer, controls, shooters
│   └── StopwatchView.svelte
├── components/
│   ├── TimerDisplay.svelte # Countdown / target status display
│   ├── ControlBar.svelte   # Start/pause/stop/reset buttons
│   ├── SeriesProgress.svelte # Program/stage/series info bar
│   ├── ProgramPicker.svelte # Program selection with info panels
│   ├── ProgramEditor.svelte # Custom program builder
│   ├── PeerList.svelte     # Connected shooters with jam/reshoot
│   ├── ConnectionStatus.svelte
│   ├── RoomCode.svelte
│   └── LangToggle.svelte
├── lib/
│   ├── stores.js           # Svelte stores (view, room, timer, preferences)
│   ├── i18n.js             # Norwegian/English translations
│   ├── storage.js          # localStorage persistence
│   ├── audio.js            # Web Audio API beeps
│   ├── timer/
│   │   ├── TimerScheduler.js  # Competition flow state machine
│   │   └── TimerEngine.js     # requestAnimationFrame countdown
│   ├── peer/
│   │   ├── PeerHost.js     # WebRTC host — room, broadcasting
│   │   ├── PeerClient.js   # WebRTC client — join, reconnect
│   │   └── messages.js     # Message protocol constants
│   └── programs/
│       └── registry.js     # NSF program definitions
└── styles/
    └── global.css
```

## License

Private