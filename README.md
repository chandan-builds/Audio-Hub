# Audio Hub

Audio Hub is a React 19 real-time communication app with a Socket.IO signaling server, WebRTC peer connections, low-latency audio tuning, camera sharing, screen sharing, chat, host controls, recording, reconnect overlays, and a CSS-variable driven theme system.

The current frontend is organized around a Coordinator-Agent-Memory WebRTC architecture. UI components consume lightweight presentation state, while RTC objects and sender references stay inside agent-level refs.

## Current Architecture

### WebRTC Coordinator

[src/hooks/webrtc/useWebRTCCoordinator.ts](src/hooks/webrtc/useWebRTCCoordinator.ts) composes the three runtime agents:

- `useSignalingAgent`: Socket.IO lifecycle, room events, SDP/ICE routing, chat, host controls, and remote media-state updates.
- `usePeerAgent`: `RTCPeerConnection` creation, perfect negotiation, ICE candidate buffering, `ontrack` classification, audio analysis, and deterministic peer teardown.
- `useMediaAgent`: local microphone/camera/screen lifecycle, `RTCRtpSender` ownership, track replacement, quality constraints, mute/video/screen controls, and device switching.

### Stable Memory Layer

[src/hooks/webrtc/memory/useWebRTCMemory.tsx](src/hooks/webrtc/memory/useWebRTCMemory.tsx) provides:

- Reactive UI state through `useWebRTCMemory()`.
- Stable agent access through `useStableMemory()`.
- Ref-owned RTC state such as `peersRef`, `senderMapRef`, ICE buffers, negotiation maps, and pending video stream maps.
- A computed `localPresentation` value for rendering local camera/screen state.

### Unified Media Presentation

The UI follows the merge rule: one user renders as one card.

Camera and screen share are represented by a single `MediaPresentation` object:

```ts
export interface MediaPresentation {
  primaryStream: MediaStream | null;
  secondaryStream: MediaStream | null;
  primarySource: "camera" | "screen" | "none";
}
```

Rules:

- Screen share is primary when active and available.
- Camera becomes a secondary PiP stream during screen share.
- Camera is primary when screen share is not active.
- No separate screen tile is rendered for the same user.

The pure helper lives in [src/hooks/webrtc/tools/presentationTools.ts](src/hooks/webrtc/tools/presentationTools.ts). `PeerCard` and focus views consume `presentation` instead of guessing from raw stream arrays.

### Deterministic Track Classification

Remote video tracks are classified by stream IDs sent through the consolidated `user-media-state` event:

- `cameraStreamId`
- `screenStreamId`

If `ontrack` fires before the matching media-state payload arrives, `usePeerAgent` parks the stream in `pendingVideoStreamsRef`. `useSignalingAgent` drains that pending map once IDs arrive. This avoids track-order guessing and prevents duplicate or stale tiles.

### Theme System

Theme state is token-driven:

- Bootstrap runs synchronously in [index.html](index.html) before React hydration.
- `ThemeProvider` mirrors the mode onto `document.documentElement`.
- Semantic `--ah-*` tokens are declared in [src/index.css](src/index.css).
- Tailwind v4 exposes the tokens as utilities such as `bg-ah-bg`, `bg-ah-surface`, `border-ah-border`, and `text-ah-text`.

There are still some legacy `dark:` utility classes in older components, but the active room shell, theme bootstrap, and PeerCard media surfaces have been moved toward semantic tokens.

## Features

- Voice chat with Bluetooth-oriented Opus SDP tuning.
- Camera video with quality presets.
- Screen sharing with merged camera PiP.
- Consolidated media-state signaling.
- Perfect negotiation for offer collision handling.
- ICE candidate buffering and connection-state cleanup.
- Active speaker detection via Web Audio analyzers.
- Chat and activity log.
- Host mute/video-disable controls.
- Pre-join device checks and permission overlay.
- Reconnection overlay and connection health monitoring.
- Local recording controls.
- Light/dark theme toggle with hydration-safe bootstrap.

## Project Structure

```text
Audio-Hub/
  components/ui/                 Shared shadcn-style UI primitives
  lib/                           Shared utilities
  server/
    index.ts                     Express + Socket.IO signaling server
    .env.example                 Backend environment template
  src/
    App.tsx                      App shell and routing state
    main.tsx                     React entry point
    index.css                    Tailwind v4 imports and theme tokens
    components/
      LobbyScreen.tsx            Legacy lobby entry
      RoomScreen.tsx             Main meeting experience
      PeerCard.tsx               Unified participant card renderer
      ControlBar.tsx             Meeting controls
      ChatPanel.tsx              Chat UI
      ThemeProvider.tsx          Runtime theme provider
      ThemeToggle.tsx            Theme switch
      prejoin/                   Pre-join camera/mic screens
      room/                      Room overlays, panels, modals
      activity/                  Activity sidebar exports
      chat/                      Chat module exports
      devices/                   Device selector exports
    hooks/
      useWebRTC.ts               Public WebRTC exports
      useConnectionMonitor.ts    Connection health monitor
      useDeviceManager.ts        Device enumeration/selection
      useKeyboardShortcuts.ts    Meeting shortcuts and push-to-talk
      useRecordingAgent.ts       Local recording flow
      useVisibilityPause.ts      Off-screen video pause helper
      webrtc/
        types.ts                 WebRTC/shared state types
        useWebRTCCoordinator.ts  Agent composition hook
        agents/
          useMediaAgent.ts       Local media lifecycle and senders
          usePeerAgent.ts        Peer connections and remote tracks
          useSignalingAgent.ts   Socket.IO signaling and room state
        memory/
          useWebRTCMemory.tsx    Context state plus stable refs
        tools/
          deviceTools.ts         Device helpers
          networkTools.ts        TURN credential fetching
          presentationTools.ts   MediaPresentation computation
          sdpTools.ts            Opus/Bluetooth SDP tuning
```

## Signaling Protocol

The server is intentionally lightweight. It keeps room membership, maps `userId` to `socketId`, relays signaling payloads, and stores simple room metadata such as role and host-controlled flags.

### HTTP

| Route | Purpose |
| --- | --- |
| `GET /health` | Server health and room count. |
| `GET /api/rooms` | Current rooms and user summaries. |
| `GET /api/rooms/:roomId` | A single room's user list. |
| `GET /api/turn-credentials` | STUN/TURN config for WebRTC. |

### Socket.IO Events

| Event | Direction | Purpose |
| --- | --- | --- |
| `join-room` | Client to server | Join or create a room and receive host/participant role. |
| `room-users` | Server to client | Existing users sent to the joining client. |
| `room-joined-success` | Server to client | Local role and host-control state. |
| `user-connected` | Server to clients | New peer joined. |
| `signal` | Bidirectional | SDP offer/answer and ICE candidate relay. |
| `user-media-state` | Client to server to peers | Consolidated mute/video/screen state plus stream IDs. |
| `user-media-control-updated` | Server to clients | Host mute/video disable state. |
| `host-mute-user` | Host client to server | Request forced mute/unmute. |
| `host-disable-video` | Host client to server | Request forced video disable/enable. |
| `chat-message` | Client to server to peers | Room chat relay. |
| `new-host-assigned` | Server to clients | Host transfer after host leaves. |
| `room-user-count` | Server to clients | Current room count. |
| `user-disconnected` | Server to clients | Peer left and should be cleaned up. |

## Environment

### Frontend

Create `.env` from `.env.example`:

```env
VITE_SOCKET_URL=https://audio-hub-server.onrender.com
```

For local development, use:

```env
VITE_SOCKET_URL=http://localhost:10000
```

### Backend

Create `server/.env` from `server/.env.example`:

```env
PORT=10000
CLIENT_URL=http://localhost:5173
TURN_SERVER_URL=turn:a.relay.metered.ca:80
TURN_SERVER_URL_TLS=turn:a.relay.metered.ca:443
TURN_SERVER_URL_TCP=turn:a.relay.metered.ca:443?transport=tcp
TURN_USERNAME=your_metered_username
TURN_CREDENTIAL=your_metered_credential
```

The server always includes Google STUN fallbacks and appends TURN servers from the environment.

## Development

Install root dependencies:

```bash
npm install
```

Install server dependencies:

```bash
cd server
npm install
```

Run frontend only:

```bash
npm run dev
```

Run server only:

```bash
npm run dev:server
```

Run both:

```bash
npm run dev:all
```

Build frontend:

```bash
npm run build
```

Type-check frontend:

```bash
npm run lint
```

Build server:

```bash
cd server
npm run build
```

Start compiled server:

```bash
cd server
npm start
```

## Operational Notes

- WebRTC sender references are owned by `useMediaAgent` through `senderMapRef`.
- `PeerData.connection` is an RTC object and should not be serialized.
- UI should render `PeerData.presentation` and `localPresentation`, not raw camera/screen stream combinations.
- Track ending, user leave, forced host video disable, and room teardown should clear streams immediately and recompute presentation.
- The backend should stay a stateless relay for media negotiation. Media layout decisions belong on the client.
- New UI surfaces should prefer semantic `--ah-*` tokens over hardcoded `dark:` color branches.

## Deployment

Frontend can be deployed as a Vite static app, for example to Vercel. The backend can be deployed as a Node service, for example to Render.

Make sure:

- `VITE_SOCKET_URL` points to the deployed backend.
- `CLIENT_URL` is included in backend CORS origins.
- TURN credentials are configured for production calls across restrictive networks.
