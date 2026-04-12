# OPK Timer

Synchronized timer for NSF 25m shooting competitions. Built as a Progressive Web App — install it on any phone, tablet, or computer and run competitions across multiple devices via a WebSocket relay server.

## Features

- **Built-in NSF programs** — Fin/Grov Pistol, Standard, Silhouette, NAIS, Rapid Fire with full stage/series timing
- **Custom programs** — Create and save your own competition programs
- **Multi-device sync** — Host creates a room, shooters join by 4-character code. Timer state syncs in real-time via a WebSocket relay server
- **Precision, Rapid & Duel modes** — Countdown timers for precision stages, hidden/visible cycling for rapid-fire and duel stages
- **Malfunction handling** — Track jams per shooter (max 2 per program, 1 per stage) with reshoot support
- **Bilingual** — Norwegian and English
- **Offline-capable PWA** — Install to home screen, works without internet after first load
- **Standalone stopwatch** — Simple stopwatch mode independent of the competition system
- **Settings** — Text scaling, sound toggle, screen wake lock, countdown format

## How it works

1. **Host** creates a room and selects a shooting program
2. **Shooters** join with the room code, their name, and lane number
3. Host controls the timer — start, pause, stop, reset
4. All connected devices display the synchronized countdown in real-time

## Self-hosting with Docker

The Docker image bundles the Svelte frontend and WebSocket relay server into a single container. Nginx serves the static files and proxies `/ws` to the Node.js relay server internally.

```bash
docker run -d -p 80:80 ghcr.io/gilbn/opk-timer:latest
```

Access the app at `http://<server-ip>/`.

For internet-facing deployments, restrict WebSocket origins:

```bash
docker run -d -p 80:80 \
  -e WS_ALLOWED_ORIGINS=https://timer.example.com \
  ghcr.io/gilbn/opk-timer:latest
```

For HTTPS, place the container behind a reverse proxy (e.g. Caddy, Traefik, nginx Proxy Manager) that handles TLS termination. The app automatically upgrades to `wss://` when served over HTTPS.

### Docker Compose

```yaml
services:
  opk-timer:
    image: ghcr.io/gilbn/opk-timer:latest
    ports:
      - "80:80"
    restart: unless-stopped
    environment:
      WS_ALLOWED_ORIGINS: "*"
```

## Tech stack

- [Svelte 5](https://svelte.dev/) — UI framework
- [Vite](https://vite.dev/) — Build tool with HMR
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — Service worker & manifest generation
- [ws](https://github.com/websockets/ws) — WebSocket relay server (Node.js)
- [Nginx](https://nginx.org/) — Static file serving & WebSocket proxy (Docker)

## Environment variables

### Frontend (build-time)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_WS_SERVER_URL` | `/ws` | WebSocket server URL. Relative paths are resolved against the current host at runtime |
| `VITE_BASE_PATH` | `/` | Base path for the app (e.g. `/timer/` if hosted under a subpath). The Docker image assumes `/` |
| `VITE_HTTPS` | `false` | Set to `true` to enable HTTPS on the Vite dev server |

### Server (runtime)

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT` | `8080` | Port the WebSocket relay server listens on |
| `WS_ALLOWED_ORIGINS` | `*` | Comma-separated list of allowed origins for WebSocket connections |

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

The dev server proxies `/ws` to `localhost:8080`. Start the WebSocket relay server in a separate terminal:

```bash
cd server && npm install && npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |
| `cd server && npm run dev` | Start WebSocket relay server (dev, auto-restart) |
| `cd server && npm start` | Start WebSocket relay server (production) |

## Project structure

```
src/
├── App.svelte                 # Root component, view routing, session restore
├── views/
│   ├── HomeView.svelte        # Landing page — create/join room, recent rooms
│   ├── LobbyView.svelte       # Host room — program selection, peer list
│   ├── TimerView.svelte       # Active competition — timer, controls, shooters
│   └── StopwatchView.svelte
├── components/
│   ├── TimerDisplay.svelte    # Countdown / target status display
│   ├── ControlBar.svelte      # Start/pause/stop/reset buttons
│   ├── SeriesProgress.svelte  # Program/stage/series info bar
│   ├── ProgramPicker.svelte   # Program selection with info panels
│   ├── ProgramEditor.svelte   # Custom program builder
│   ├── PeerList.svelte        # Connected shooters with jam/reshoot
│   ├── JumpToModal.svelte     # Jump to stage/exercise/series
│   ├── ConnectionStatus.svelte
│   ├── SettingsMenu.svelte    # Text scale, sound, wake lock, format
│   ├── FontSizeToggle.svelte
│   ├── RoomCode.svelte
│   └── LangToggle.svelte
├── lib/
│   ├── stores.js              # Svelte stores (view, room, timer, preferences)
│   ├── config.js              # WebSocket server URL resolution
│   ├── i18n.js                # Norwegian/English translations
│   ├── storage.js             # localStorage persistence
│   ├── audio.js               # Web Audio API beeps & vibration
│   ├── wakeLock.js            # Screen wake lock
│   ├── timer/
│   │   ├── TimerScheduler.js  # Competition flow state machine
│   │   └── TimerEngine.js     # requestAnimationFrame countdown
│   ├── peer/
│   │   ├── SocketHost.js      # WebSocket host — room creation, broadcasting
│   │   ├── SocketClient.js    # WebSocket client — join, auto-reconnect
│   │   └── messages.js        # Message protocol constants
│   └── programs/
│       └── registry.js        # NSF program definitions + custom programs
└── styles/
    └── global.css

server/
├── index.js                   # WebSocket relay server (room registry, message fanout)
├── package.json
├── Dockerfile                 # Server-only image (used by Fly.io)
└── fly.toml                   # Fly.io deployment config

Dockerfile                     # Combined image (frontend + relay server)
nginx.conf                     # Nginx config for Docker image
docker-start.sh                # Container entrypoint
```
