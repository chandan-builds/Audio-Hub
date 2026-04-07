# 🎧 Audio Hub

Real-time voice chat and screen sharing — connect with anyone, anywhere.

![Audio Hub](https://img.shields.io/badge/WebRTC-Audio%20Chat-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

## Features

- 🎙️ **Crystal-clear audio** — Bluetooth-optimized, low-latency voice chat
- 🖥️ **Screen sharing** — Share your screen with focus mode
- 💬 **Text chat** — Real-time messaging alongside voice
- 🌍 **Global rooms** — Create or join rooms instantly
- 🔒 **Encrypted** — WebRTC peer-to-peer encryption
- 📱 **Responsive** — Works on desktop, tablet, and mobile
- 🎯 **Device selector** — Switch microphones on the fly
- 📊 **Audio visualizer** — See who's speaking in real-time

## Architecture

```
Audio-Hub/
├── src/              ← React frontend (deploy to Vercel)
│   ├── App.tsx
│   ├── hooks/
│   │   └── useWebRTC.ts
│   └── components/
│       ├── LobbyScreen.tsx
│       ├── RoomScreen.tsx
│       ├── PeerCard.tsx
│       ├── ControlBar.tsx
│       ├── ChatPanel.tsx
│       ├── ActivitySidebar.tsx
│       └── DeviceSelector.tsx
│
└── server/           ← Socket.io server (deploy to Render)
    └── index.ts
```

## Quick Start

### Prerequisites
- Node.js 20+
- [Metered.ca](https://www.metered.ca/stun-turn) TURN credentials (free tier)

### 1. Install Dependencies

```bash
# Client
npm install

# Server
cd server && npm install
```

### 2. Configure Environment

```bash
# Client (.env.local)
VITE_SOCKET_URL=http://localhost:10000

# Server (server/.env)
PORT=10000
TURN_USERNAME=your_metered_username
TURN_CREDENTIAL=your_metered_credential
```

### 3. Run Locally

```bash
# Terminal 1: Start server
cd server && npm run dev

# Terminal 2: Start client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Deployment

### Frontend → Vercel

1. Connect your GitHub repo to Vercel
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variable: `VITE_SOCKET_URL=https://your-server.onrender.com`

### Backend → Render

1. Create a new **Web Service** on Render
2. Set root directory: `server`
3. Set build command: `npm install && npx tsc`
4. Set start command: `node dist/index.js`
5. Add environment variables:
   - `CLIENT_URL=https://your-app.vercel.app`
   - `TURN_USERNAME=your_metered_username`
   - `TURN_CREDENTIAL=your_metered_credential`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS 4, shadcn/ui |
| Real-time | WebRTC, Socket.io |
| Animation | Framer Motion |
| TURN/STUN | Metered.ca |
| Hosting | Vercel (client) + Render (server) |

## Bluetooth Audio Optimization

Audio Hub uses specialized WebRTC constraints for minimal Bluetooth latency:
- Mono audio (reduces BT codec overhead)
- 48kHz sample rate (native Opus frequency)
- Zero target latency
- Opus SDP munging with `ptime=10` and `useinbandfec=1`
