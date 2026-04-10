# 🎧 Audio Hub: Protocol-Level Deep Dive

**Audio Hub** is a high-performance, real-time voice and video communication platform built with a custom-engineered **Agentic WebRTC Architecture**. Unlike generic video chat apps, Audio Hub is optimized for ultra-low latency, specifically targeting **Bluetooth audio performance** and **interactive collaboration** through advanced media control.

![Audio Hub Architecture](https://img.shields.io/badge/Architecture-Agentic%20Coordinator-blueviolet?style=for-the-badge) ![WebRTC Layer](https://img.shields.io/badge/WebRTC-Perfect%20Negotiation-blue?style=for-the-badge) ![Audio Engine](https://img.shields.io/badge/Audio-Bluetooth%20Optimized-green?style=for-the-badge) ![React](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react&logoColor=black)

---

## 🧠 Core Philosophy: Agentic Architecture

The application is built on a "Coordinator-Agent-Memory" design pattern. This decouples the complex state of WebRTC from the UI and ensures high reliability in signaling.

### 1. `useWebRTCCoordinator` (The Brain)
The central orchestrator that boots up specialized sub-agents. It manages the lifecycle and dependencies between signaling, media tracks, and peer connections.

### 2. The Agent Layer (The Workers)
*   **`useSignalingAgent`**: Manages the Socket.io connection. It handles room logistics, message relaying, and the heavy lifting of routing WebRTC offers/answers based on `userId` to `socketId` mappings.
*   **`usePeerAgent`**: The core WebRTC engine. Implements **Perfect Negotiation** (Polite vs. Impolite peers) to handle glare/collision scenarios. It manages a dynamic pool of `RTCPeerConnection` objects.
*   **`useMediaAgent`**: Controls the hardware. It handles local stream acquisition, track replacement (`replaceTrack`), and specialized media constraints.

### 3. `useWebRTCMemory` (The Truth)
A centralized state store using a **Stable Ref Pattern**. Agents access the "Memory" via a stable `MutableRefObject`, allowing hooks to access the latest state (like the current Socket connection or local stream) without triggering re-renders or creating stale closure bugs.

---

## 🛠️ Technical Implementation Details

### 🎙️ Bluetooth-Native Audio Engine
Audio Hub uses specialized **SDP Munging** to force browsers into a low-latency mode suitable for Bluetooth headsets (which usually suffer from 200ms+ latency in standard WebRTC).
*   **Opus Munging**: Forces `ptime=10` (10ms frames instead of 20ms) and `stereo=0` to reduce bitrate and processing overhead.
*   **BT Constraints**: Configures `EchoCancellation` as true but disables `NoiseSuppression` and `AutoGainControl` to shave off processing milliseconds.
*   **CBR Mode**: Uses Constant Bitrate to prevent Bluetooth buffer fluctuations.

### 🖥️ High-Fidelity Screen Sharing
The screen share implementation features a custom **Interaction Engine**:
*   **Dynamic Focus**: Automatically promotes screen share streams to the primary layout.
*   **Zoom & Pan**: Direct control via mouse-wheel zoom and drag-to-pan, allowing users to inspect small text or UI details in high resolution.
*   **Resolution Switching**: Intelligent fallback between 720p/1080p based on detected network constraints.

### 💬 Persistent Chat Pinning
A first-of-its-kind chat system where users can "pin" messages.
*   **Sticky Header**: Pinned messages animate from the chat flow into a dedicated global header.
*   **Local Persistence**: Pinned state is mirrored in `localStorage`, ensuring the context remains even after a refresh.

---

## 📡 Signaling Protocol & Events

The signaling server (`server/index.ts`) acts as a "Stateless Relay" with minimal persistence.

| Event | Direction | Purpose |
| :--- | :--- | :--- |
| `join-room` | Client → Server | Initiates room entry; assigns `host` or `participant` role. |
| `room-joined-success` | Server → Client | Confirms role and current room permissions. |
| `signal` | Bi-directional | Transports SDP offers, answers, and ICE candidates. |
| `user-status-changed` | Client → Server | Notifies peers of Mic/Video/Screen share state. |
| `host-mute-user` | Client → Server | (Host only) Remotely mutes a participant. |
| `chat-message` | Client → Server | Relays messages with consistent timestamps. |

---

## 📁 System Architecture Tree

```text
Audio-Hub/
├── src/
│   ├── hooks/
│   │   └── webrtc/
│   │       ├── agents/        # Logical controllers (Signaling, Media, Peers)
│   │       ├── memory/        # The Stable Ref state store & Context Provider
│   │       ├── tools/         # SDP Mungers, Device tools, Math helpers
│   │       └── types.ts       # Central source of truth for WebRTC interfaces
│   ├── components/
│   │   ├── room/              # The active meeting UI
│   │   │   ├── PeerCard.tsx   # Individual stream renderers with waveform viz
│   │   │   ├── ControlBar.tsx # Advanced toggle logic
│   │   │   └── ChatPanel.tsx  # Message logic & Pinning system
│   │   └── UI/                # Shared glassmorphic design units
│   └── lib/                   # Utility functions (Shadcn components, tailwind-merge)
└── server/
    └── index.ts               # Node/Express Signaling + Socket.io Logic
```

---

## 🚀 Environment Configuration

### Frontend (`.env`)
```env
VITE_SOCKET_URL=https://your-server.com
VITE_STUN_SERVER=stun:stun.l.google.com:19302
```

### Backend (`server/.env`)
```env
PORT=10000
TURN_USERNAME=your_metered_ca_username
TURN_CREDENTIAL=your_metered_ca_password
CLIENT_URL=https://your-frontend.vercel.app
```

---

## 🔮 Roadmap for AI-Driven Upgrades

Use this section to ask your AI model for specific improvements:

1.  **Bug Hunting**:
    *   "Check `usePeerAgent.ts` for potential `ICE connection failed` retry loops."
    *   "Analyze the `ONTRAK` logic in `usePeerAgent` for camera vs. screen share differentiation edge cases."
2.  **Modifications**:
    *   "Implement a **Recording Agent** that captures the `localStream` and `remoteStream` into a combined MediaRecorder."
    *   "Add a **Noise Suppression Agent** using the `Web Audio API` to filter background hum."
3.  **Upgrades**:
    *   "Upgrade the signaling protocol to support **End-to-End Encryption (E2EE)** via `RTCRtpReceiver.insertableStreams`."
    *   "Integrate **AI-Powered Subtitles** by piping the audio stream to a Whisper API agent."

---

## 👨‍💻 Engineering Credits
Designed and engineered by **chandan-builds**. Built for the next generation of real-time collaboration.
collaboration.
