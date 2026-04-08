# 🎧 Audio Hub

Real-time voice chat and screen sharing application built for modern browsers. Connect with anyone globally, featuring low-latency communication, premium UI aesthetics, and instant room generation.

![Audio Hub](https://img.shields.io/badge/WebRTC-Audio%20Chat-blue?style=for-the-badge) ![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black) ![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css) ![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite) ![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

## ✨ Features

- 🎙️ **Crystal-Clear Audio** — Bluetooth-optimized, low-latency voice chat using Opus codecs.
- 🖥️ **Interactive Screen Sharing** — Share screens with dynamic focus mode. Includes true **Fullscreen mode**, interactive **Mouse-wheel Zoom**, and **Drag-to-Pan** navigation controls on the active screenshare feed.
- 💬 **Text Chat & Pinning** — Integrated real-time text messaging alongside voice and video. Features a persistent **Chat Pinning System** natively storing data in local storage, animating pinned chats to a dedicated sticky header.
- 🌍 **Instant Global Rooms** — Instantly create and share URL-based rooms to connect with peers.
- 🎨 **Premium UI/UX** — Glassmorphism aesthetics, responsive layouts, subtle framer-motion animations, custom UI tooltips, and a sleek dark mode.
- 🔒 **Encrypted Peer-to-Peer** — Secure WebRTC P2P connection handling.
- 🎯 **Device Management** — Switch microphones and audio devices gracefully.
- 📊 **Audio Visualizer** — Real-time waveform-style visualizations to see who is speaking.

## 🏗️ Architecture

```
Audio-Hub/
├── src/              ← React frontend (Deployed to Vercel)
│   ├── App.tsx       ← Main application wrapper & entry point
│   ├── hooks/
│   │   └── webrtc/         ← Scalable Subagent architecture (Coordinator -> Agents -> Memory)
│   └── components/
│       ├── LobbyScreen.tsx
│       └── room/
│           ├── RoomScreen.tsx
│           ├── PeerCard.tsx
│           ├── ControlBar.tsx
│           ├── ChatPanel.tsx     ← Chat Pinning & UI Logic
│           ├── DeviceSelector.tsx
│           └── ActivitySidebar.tsx
│
└── server/           ← Express + Socket.io signaling server (Deployed to Render)
    └── index.ts      ← Socket signaling events & WebRTC room metadata
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- [Metered.ca](https://www.metered.ca/stun-turn) TURN credentials (free tier) for reliable P2P NAT traversal.

### 1. Install Dependencies

```bash
# Install Client Dependencies
npm install

# Install Server Dependencies
cd server && npm install
```

### 2. Configure Environment

Create the respective `.env` files in your root and `server` directories.

```bash
# Client (.env)
VITE_SOCKET_URL=http://localhost:10000

# Server (server/.env)
PORT=10000
TURN_USERNAME=your_metered_username
TURN_CREDENTIAL=your_metered_credential
CLIENT_URL=http://localhost:5173
```

### 3. Run Locally

You need two terminals to run both the signaling server and the vite client.

```bash
# Terminal 1: Start signaling server
cd server && npm run dev

# Terminal 2: Start frontend client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🌐 Deployment

This project uses a split architecture, perfectly optimized for cloud hosting natively on Vercel and Render.

### Frontend → Vercel
1. Connect your GitHub repo to Vercel.
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variable: `VITE_SOCKET_URL=https://your-signaling-server.onrender.com`

### Backend → Render
1. Create a new **Web Service** on Render.
2. Set root directory: `server`
3. Set build command: `npm install && npx tsc`
4. Set start command: `node dist/index.js`
5. Add environment variables:
   - `CLIENT_URL=https://your-frontend-app.vercel.app` (Important for CORS)
   - `TURN_USERNAME=your_metered_username`
   - `TURN_CREDENTIAL=your_metered_credential`

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite |
| **Styling** | Tailwind CSS v4, shadcn/ui, Lucide Icons |
| **Real-time** | WebRTC, Socket.io |
| **Animation** | Framer Motion & CSS UI utilities |
| **P2P Config** | Metered.ca (STUN/TURN) |
| **Hosting** | Vercel (Client) + Render (Server) |

## 📡 Bluetooth Audio Optimization

Audio Hub uses specialized WebRTC constraints targeting minimal Bluetooth latency, improving the experience drastically on wireless earphones:
- Mono audio streaming (reduces BT codec transmission payload)
- 48kHz core sample rate (native Opus processing frequency)
- Zero target acoustic latency configurations
- Opus SDP munging applying `ptime=10` and `useinbandfec=1`

## 👨‍💻 Credits

Designed and engineered by **chandan-builds**.
