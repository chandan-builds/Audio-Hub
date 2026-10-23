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

<!-- Automated README history sample f2a14e14/1/1; assigned commit date 2026-08-31T09:40:00+05:30. -->

<!-- Automated README history sample f2a14e14/1/2; assigned commit date 2026-08-31T10:18:00+05:30. -->

<!-- Automated README history sample f2a14e14/2/1; assigned commit date 2026-08-31T11:42:00+05:30. -->

<!-- Automated README history sample f2a14e14/2/2; assigned commit date 2026-08-31T12:21:00+05:30. -->

<!-- Automated README history sample f2a14e14/2/3; assigned commit date 2026-08-31T13:02:00+05:30. -->

<!-- Automated README history sample f2a14e14/3/1; assigned commit date 2026-09-01T09:13:00+05:30. -->

<!-- Automated README history sample f2a14e14/3/2; assigned commit date 2026-09-01T10:29:00+05:30. -->

<!-- Automated README history sample f2a14e14/4/1; assigned commit date 2026-09-01T11:28:00+05:30. -->

<!-- Automated README history sample f2a14e14/4/2; assigned commit date 2026-09-01T12:36:00+05:30. -->

<!-- Automated README history sample f2a14e14/4/3; assigned commit date 2026-09-01T13:03:00+05:30. -->

<!-- Automated README history sample f2a14e14/5/1; assigned commit date 2026-09-01T14:14:00+05:30. -->

<!-- Automated README history sample f2a14e14/5/2; assigned commit date 2026-09-01T15:06:00+05:30. -->

<!-- Automated README history sample f2a14e14/5/3; assigned commit date 2026-09-01T16:45:00+05:30. -->

<!-- Automated README history sample f2a14e14/6/1; assigned commit date 2026-09-02T09:20:00+05:30. -->

<!-- Automated README history sample f2a14e14/6/2; assigned commit date 2026-09-02T10:01:00+05:30. -->

<!-- Automated README history sample f2a14e14/7/1; assigned commit date 2026-09-02T11:04:00+05:30. -->

<!-- Automated README history sample f2a14e14/7/2; assigned commit date 2026-09-02T12:05:00+05:30. -->

<!-- Automated README history sample f2a14e14/7/3; assigned commit date 2026-09-02T13:41:00+05:30. -->

<!-- Automated README history sample f2a14e14/8/1; assigned commit date 2026-09-02T14:38:00+05:30. -->

<!-- Automated README history sample f2a14e14/8/2; assigned commit date 2026-09-03T09:04:00+05:30. -->

<!-- Automated README history sample f2a14e14/9/1; assigned commit date 2026-09-03T10:18:00+05:30. -->

<!-- Automated README history sample f2a14e14/9/2; assigned commit date 2026-09-03T11:59:00+05:30. -->

<!-- Automated README history sample f2a14e14/9/3; assigned commit date 2026-09-03T12:09:00+05:30. -->

<!-- Automated README history sample f2a14e14/10/1; assigned commit date 2026-09-03T13:31:00+05:30. -->

<!-- Automated README history sample f2a14e14/10/2; assigned commit date 2026-09-03T14:58:00+05:30. -->

<!-- Automated README history sample f2a14e14/10/3; assigned commit date 2026-09-03T15:40:00+05:30. -->

<!-- Automated README history sample f2a14e14/11/1; assigned commit date 2026-09-03T16:11:00+05:30. -->

<!-- Automated README history sample f2a14e14/11/2; assigned commit date 2026-09-03T17:38:00+05:30. -->

<!-- Automated README history sample f2a14e14/12/1; assigned commit date 2026-09-04T09:58:00+05:30. -->

<!-- Automated README history sample f2a14e14/12/2; assigned commit date 2026-09-04T10:45:00+05:30. -->

<!-- Automated README history sample f2a14e14/12/3; assigned commit date 2026-09-04T11:22:00+05:30. -->

<!-- Automated README history sample f2a14e14/13/1; assigned commit date 2026-09-04T12:44:00+05:30. -->

<!-- Automated README history sample f2a14e14/13/2; assigned commit date 2026-09-04T13:53:00+05:30. -->

<!-- Automated README history sample f2a14e14/14/1; assigned commit date 2026-09-04T14:03:00+05:30. -->

<!-- Automated README history sample f2a14e14/14/2; assigned commit date 2026-09-07T09:52:00+05:30. -->

<!-- Automated README history sample f2a14e14/14/3; assigned commit date 2026-09-07T10:44:00+05:30. -->

<!-- Automated README history sample f2a14e14/15/1; assigned commit date 2026-09-07T11:20:00+05:30. -->

<!-- Automated README history sample f2a14e14/15/2; assigned commit date 2026-09-07T12:41:00+05:30. -->

<!-- Automated README history sample f2a14e14/15/3; assigned commit date 2026-09-07T13:34:00+05:30. -->

<!-- Automated README history sample f2a14e14/16/1; assigned commit date 2026-09-07T14:10:00+05:30. -->

<!-- Automated README history sample f2a14e14/16/2; assigned commit date 2026-09-07T15:32:00+05:30. -->

<!-- Automated README history sample f2a14e14/17/1; assigned commit date 2026-09-07T16:16:00+05:30. -->

<!-- Automated README history sample f2a14e14/17/2; assigned commit date 2026-09-08T09:27:00+05:30. -->

<!-- Automated README history sample f2a14e14/17/3; assigned commit date 2026-09-08T10:14:00+05:30. -->

<!-- Automated README history sample f2a14e14/18/1; assigned commit date 2026-09-08T11:41:00+05:30. -->

<!-- Automated README history sample f2a14e14/18/2; assigned commit date 2026-09-08T12:56:00+05:30. -->

<!-- Automated README history sample f2a14e14/19/1; assigned commit date 2026-09-08T13:56:00+05:30. -->

<!-- Automated README history sample f2a14e14/19/2; assigned commit date 2026-09-08T14:00:00+05:30. -->

<!-- Automated README history sample f2a14e14/19/3; assigned commit date 2026-09-09T09:30:00+05:30. -->

<!-- Automated README history sample f2a14e14/20/1; assigned commit date 2026-09-09T10:03:00+05:30. -->

<!-- Automated README history sample f2a14e14/20/2; assigned commit date 2026-09-09T11:21:00+05:30. -->

<!-- Automated README history sample f2a14e14/20/3; assigned commit date 2026-09-09T12:29:00+05:30. -->

<!-- Automated README history sample f2a14e14/21/1; assigned commit date 2026-09-09T13:45:00+05:30. -->

<!-- Automated README history sample f2a14e14/21/2; assigned commit date 2026-09-10T09:43:00+05:30. -->

<!-- Automated README history sample f2a14e14/22/1; assigned commit date 2026-09-10T10:15:00+05:30. -->

<!-- Automated README history sample f2a14e14/22/2; assigned commit date 2026-09-10T11:32:00+05:30. -->

<!-- Automated README history sample f2a14e14/22/3; assigned commit date 2026-09-10T12:46:00+05:30. -->

<!-- Automated README history sample f2a14e14/23/1; assigned commit date 2026-09-10T13:50:00+05:30. -->

<!-- Automated README history sample f2a14e14/23/2; assigned commit date 2026-09-10T14:25:00+05:30. -->

<!-- Automated README history sample f2a14e14/24/1; assigned commit date 2026-09-11T09:47:00+05:30. -->

<!-- Automated README history sample f2a14e14/24/2; assigned commit date 2026-09-11T10:04:00+05:30. -->

<!-- Automated README history sample f2a14e14/24/3; assigned commit date 2026-09-11T11:58:00+05:30. -->

<!-- Automated README history sample f2a14e14/25/1; assigned commit date 2026-09-11T12:25:00+05:30. -->

<!-- Automated README history sample f2a14e14/25/2; assigned commit date 2026-09-11T13:52:00+05:30. -->

<!-- Automated README history sample f2a14e14/25/3; assigned commit date 2026-09-11T14:01:00+05:30. -->

<!-- Automated README history sample f2a14e14/26/1; assigned commit date 2026-09-11T15:49:00+05:30. -->

<!-- Automated README history sample f2a14e14/26/2; assigned commit date 2026-09-14T09:22:00+05:30. -->

<!-- Automated README history sample f2a14e14/27/1; assigned commit date 2026-09-14T10:58:00+05:30. -->

<!-- Automated README history sample f2a14e14/27/2; assigned commit date 2026-09-14T11:49:00+05:30. -->

<!-- Automated README history sample f2a14e14/27/3; assigned commit date 2026-09-14T12:34:00+05:30. -->

<!-- Automated README history sample f2a14e14/28/1; assigned commit date 2026-09-14T13:44:00+05:30. -->

<!-- Automated README history sample f2a14e14/28/2; assigned commit date 2026-09-14T14:02:00+05:30. -->

<!-- Automated README history sample f2a14e14/28/3; assigned commit date 2026-09-14T15:25:00+05:30. -->

<!-- Automated README history sample f2a14e14/29/1; assigned commit date 2026-09-15T09:06:00+05:30. -->

<!-- Automated README history sample f2a14e14/29/2; assigned commit date 2026-09-15T10:47:00+05:30. -->

<!-- Automated README history sample f2a14e14/30/1; assigned commit date 2026-09-15T11:03:00+05:30. -->

<!-- Automated README history sample f2a14e14/30/2; assigned commit date 2026-09-15T12:07:00+05:30. -->

<!-- Automated README history sample f2a14e14/30/3; assigned commit date 2026-09-15T13:52:00+05:30. -->

<!-- Automated README history sample f2a14e14/31/1; assigned commit date 2026-09-16T09:01:00+05:30. -->

<!-- Automated README history sample f2a14e14/31/2; assigned commit date 2026-09-16T10:33:00+05:30. -->

<!-- Automated README history sample f2a14e14/32/1; assigned commit date 2026-09-16T11:44:00+05:30. -->

<!-- Automated README history sample f2a14e14/32/2; assigned commit date 2026-09-16T12:36:00+05:30. -->

<!-- Automated README history sample f2a14e14/32/3; assigned commit date 2026-09-16T13:51:00+05:30. -->

<!-- Automated README history sample f2a14e14/33/1; assigned commit date 2026-09-16T14:06:00+05:30. -->

<!-- Automated README history sample f2a14e14/33/2; assigned commit date 2026-09-17T09:35:00+05:30. -->

<!-- Automated README history sample f2a14e14/33/3; assigned commit date 2026-09-17T10:14:00+05:30. -->

<!-- Automated README history sample f2a14e14/34/1; assigned commit date 2026-09-17T11:22:00+05:30. -->

<!-- Automated README history sample f2a14e14/34/2; assigned commit date 2026-09-17T12:15:00+05:30. -->

<!-- Automated README history sample f2a14e14/35/1; assigned commit date 2026-09-17T13:00:00+05:30. -->

<!-- Automated README history sample f2a14e14/35/2; assigned commit date 2026-09-17T14:16:00+05:30. -->

<!-- Automated README history sample f2a14e14/35/3; assigned commit date 2026-09-18T09:21:00+05:30. -->

<!-- Automated README history sample f2a14e14/36/1; assigned commit date 2026-09-18T10:21:00+05:30. -->

<!-- Automated README history sample f2a14e14/36/2; assigned commit date 2026-09-18T11:32:00+05:30. -->

<!-- Automated README history sample f2a14e14/37/1; assigned commit date 2026-09-18T12:56:00+05:30. -->

<!-- Automated README history sample f2a14e14/37/2; assigned commit date 2026-09-18T13:33:00+05:30. -->

<!-- Automated README history sample f2a14e14/37/3; assigned commit date 2026-09-18T14:37:00+05:30. -->

<!-- Automated README history sample f2a14e14/38/1; assigned commit date 2026-09-21T09:05:00+05:30. -->

<!-- Automated README history sample f2a14e14/38/2; assigned commit date 2026-09-21T10:26:00+05:30. -->

<!-- Automated README history sample f2a14e14/38/3; assigned commit date 2026-09-21T11:33:00+05:30. -->

<!-- Automated README history sample f2a14e14/39/1; assigned commit date 2026-09-21T12:55:00+05:30. -->

<!-- Automated README history sample f2a14e14/39/2; assigned commit date 2026-09-21T13:10:00+05:30. -->

<!-- Automated README history sample f2a14e14/40/1; assigned commit date 2026-09-21T14:07:00+05:30. -->

<!-- Automated README history sample f2a14e14/40/2; assigned commit date 2026-09-21T15:26:00+05:30. -->

<!-- Automated README history sample f2a14e14/40/3; assigned commit date 2026-09-21T16:59:00+05:30. -->

<!-- Automated README history sample f2a14e14/41/1; assigned commit date 2026-09-22T09:09:00+05:30. -->

<!-- Automated README history sample f2a14e14/41/2; assigned commit date 2026-09-22T10:50:00+05:30. -->

<!-- Automated README history sample f2a14e14/42/1; assigned commit date 2026-09-22T11:57:00+05:30. -->

<!-- Automated README history sample f2a14e14/42/2; assigned commit date 2026-09-22T12:33:00+05:30. -->

<!-- Automated README history sample f2a14e14/42/3; assigned commit date 2026-09-22T13:26:00+05:30. -->

<!-- Automated README history sample f2a14e14/43/1; assigned commit date 2026-09-22T14:36:00+05:30. -->

<!-- Automated README history sample f2a14e14/43/2; assigned commit date 2026-09-23T09:37:00+05:30. -->

<!-- Automated README history sample f2a14e14/43/3; assigned commit date 2026-09-23T10:26:00+05:30. -->

<!-- Automated README history sample f2a14e14/44/1; assigned commit date 2026-09-23T11:09:00+05:30. -->

<!-- Automated README history sample f2a14e14/44/2; assigned commit date 2026-09-23T12:40:00+05:30. -->

<!-- Automated README history sample f2a14e14/45/1; assigned commit date 2026-09-23T13:35:00+05:30. -->

<!-- Automated README history sample f2a14e14/45/2; assigned commit date 2026-09-23T14:12:00+05:30. -->

<!-- Automated README history sample f2a14e14/45/3; assigned commit date 2026-09-23T15:31:00+05:30. -->

<!-- Automated README history sample f2a14e14/46/1; assigned commit date 2026-09-23T16:07:00+05:30. -->

<!-- Automated README history sample f2a14e14/46/2; assigned commit date 2026-09-23T17:49:00+05:30. -->

<!-- Automated README history sample f2a14e14/47/1; assigned commit date 2026-09-24T09:49:00+05:30. -->

<!-- Automated README history sample f2a14e14/47/2; assigned commit date 2026-09-24T10:45:00+05:30. -->

<!-- Automated README history sample f2a14e14/47/3; assigned commit date 2026-09-24T11:35:00+05:30. -->

<!-- Automated README history sample f2a14e14/48/1; assigned commit date 2026-09-24T12:12:00+05:30. -->

<!-- Automated README history sample f2a14e14/48/2; assigned commit date 2026-09-24T13:10:00+05:30. -->

<!-- Automated README history sample f2a14e14/48/3; assigned commit date 2026-09-25T09:36:00+05:30. -->

<!-- Automated README history sample f2a14e14/49/1; assigned commit date 2026-09-25T10:51:00+05:30. -->

<!-- Automated README history sample f2a14e14/49/2; assigned commit date 2026-09-25T11:56:00+05:30. -->

<!-- Automated README history sample f2a14e14/50/1; assigned commit date 2026-09-25T12:25:00+05:30. -->

<!-- Automated README history sample f2a14e14/50/2; assigned commit date 2026-09-25T13:46:00+05:30. -->

<!-- Automated README history sample f2a14e14/50/3; assigned commit date 2026-09-28T09:03:00+05:30. -->

<!-- Automated README history sample f2a14e14/51/1; assigned commit date 2026-09-28T10:39:00+05:30. -->

<!-- Automated README history sample f2a14e14/51/2; assigned commit date 2026-09-28T11:25:00+05:30. -->

<!-- Automated README history sample f2a14e14/51/3; assigned commit date 2026-09-28T12:36:00+05:30. -->

<!-- Automated README history sample f2a14e14/52/1; assigned commit date 2026-09-28T13:32:00+05:30. -->

<!-- Automated README history sample f2a14e14/52/2; assigned commit date 2026-09-28T14:02:00+05:30. -->

<!-- Automated README history sample f2a14e14/53/1; assigned commit date 2026-09-28T15:05:00+05:30. -->

<!-- Automated README history sample f2a14e14/53/2; assigned commit date 2026-09-29T09:02:00+05:30. -->

<!-- Automated README history sample f2a14e14/53/3; assigned commit date 2026-09-29T10:01:00+05:30. -->

<!-- Automated README history sample f2a14e14/54/1; assigned commit date 2026-09-29T11:08:00+05:30. -->

<!-- Automated README history sample f2a14e14/54/2; assigned commit date 2026-09-29T12:09:00+05:30. -->

<!-- Automated README history sample f2a14e14/55/1; assigned commit date 2026-09-29T13:03:00+05:30. -->

<!-- Automated README history sample f2a14e14/55/2; assigned commit date 2026-09-29T14:24:00+05:30. -->

<!-- Automated README history sample f2a14e14/55/3; assigned commit date 2026-09-30T09:50:00+05:30. -->

<!-- Automated README history sample f2a14e14/56/1; assigned commit date 2026-09-30T10:12:00+05:30. -->

<!-- Automated README history sample f2a14e14/56/2; assigned commit date 2026-09-30T11:33:00+05:30. -->

<!-- Automated README history sample f2a14e14/56/3; assigned commit date 2026-09-30T12:49:00+05:30. -->

<!-- Automated README history sample f2a14e14/57/1; assigned commit date 2026-09-30T13:33:00+05:30. -->

<!-- Automated README history sample f2a14e14/57/2; assigned commit date 2026-09-30T14:01:00+05:30. -->

<!-- Automated README history sample f2a14e14/58/1; assigned commit date 2026-09-30T15:16:00+05:30. -->

<!-- Automated README history sample f2a14e14/58/2; assigned commit date 2026-09-30T16:11:00+05:30. -->

<!-- Automated README history sample f2a14e14/58/3; assigned commit date 2026-10-01T09:55:00+05:30. -->

<!-- Automated README history sample f2a14e14/59/1; assigned commit date 2026-10-01T10:32:00+05:30. -->

<!-- Automated README history sample f2a14e14/59/2; assigned commit date 2026-10-01T11:13:00+05:30. -->

<!-- Automated README history sample f2a14e14/60/1; assigned commit date 2026-10-01T12:54:00+05:30. -->

<!-- Automated README history sample f2a14e14/60/2; assigned commit date 2026-10-01T13:14:00+05:30. -->

<!-- Automated README history sample f2a14e14/60/3; assigned commit date 2026-10-01T14:38:00+05:30. -->

<!-- Automated README history sample f2a14e14/61/1; assigned commit date 2026-10-01T15:17:00+05:30. -->

<!-- Automated README history sample f2a14e14/61/2; assigned commit date 2026-10-01T16:59:00+05:30. -->

<!-- Automated README history sample f2a14e14/61/3; assigned commit date 2026-10-01T17:01:00+05:30. -->

<!-- Automated README history sample f2a14e14/62/1; assigned commit date 2026-10-02T09:32:00+05:30. -->

<!-- Automated README history sample f2a14e14/62/2; assigned commit date 2026-10-02T10:06:00+05:30. -->

<!-- Automated README history sample f2a14e14/63/1; assigned commit date 2026-10-02T11:36:00+05:30. -->

<!-- Automated README history sample f2a14e14/63/2; assigned commit date 2026-10-02T12:00:00+05:30. -->

<!-- Automated README history sample f2a14e14/63/3; assigned commit date 2026-10-02T13:11:00+05:30. -->

<!-- Automated README history sample f2a14e14/64/1; assigned commit date 2026-10-02T14:11:00+05:30. -->

<!-- Automated README history sample f2a14e14/64/2; assigned commit date 2026-10-02T15:53:00+05:30. -->

<!-- Automated README history sample f2a14e14/65/1; assigned commit date 2026-10-05T09:20:00+05:30. -->

<!-- Automated README history sample f2a14e14/65/2; assigned commit date 2026-10-05T10:19:00+05:30. -->

<!-- Automated README history sample f2a14e14/65/3; assigned commit date 2026-10-05T11:03:00+05:30. -->

<!-- Automated README history sample f2a14e14/66/1; assigned commit date 2026-10-05T12:33:00+05:30. -->

<!-- Automated README history sample f2a14e14/66/2; assigned commit date 2026-10-05T13:12:00+05:30. -->

<!-- Automated README history sample f2a14e14/66/3; assigned commit date 2026-10-05T14:37:00+05:30. -->

<!-- Automated README history sample f2a14e14/67/1; assigned commit date 2026-10-06T09:28:00+05:30. -->

<!-- Automated README history sample f2a14e14/67/2; assigned commit date 2026-10-06T10:43:00+05:30. -->

<!-- Automated README history sample f2a14e14/68/1; assigned commit date 2026-10-06T11:20:00+05:30. -->

<!-- Automated README history sample f2a14e14/68/2; assigned commit date 2026-10-06T12:07:00+05:30. -->

<!-- Automated README history sample f2a14e14/68/3; assigned commit date 2026-10-06T13:31:00+05:30. -->

<!-- Automated README history sample f2a14e14/69/1; assigned commit date 2026-10-06T14:42:00+05:30. -->

<!-- Automated README history sample f2a14e14/69/2; assigned commit date 2026-10-06T15:48:00+05:30. -->

<!-- Automated README history sample f2a14e14/70/1; assigned commit date 2026-10-06T16:41:00+05:30. -->

<!-- Automated README history sample f2a14e14/70/2; assigned commit date 2026-10-06T17:18:00+05:30. -->

<!-- Automated README history sample f2a14e14/70/3; assigned commit date 2026-10-06T18:54:00+05:30. -->

<!-- Automated README history sample f2a14e14/71/1; assigned commit date 2026-10-07T09:07:00+05:30. -->

<!-- Automated README history sample f2a14e14/71/2; assigned commit date 2026-10-07T10:04:00+05:30. -->

<!-- Automated README history sample f2a14e14/71/3; assigned commit date 2026-10-07T11:48:00+05:30. -->

<!-- Automated README history sample f2a14e14/72/1; assigned commit date 2026-10-07T12:27:00+05:30. -->

<!-- Automated README history sample f2a14e14/72/2; assigned commit date 2026-10-07T13:23:00+05:30. -->

<!-- Automated README history sample f2a14e14/73/1; assigned commit date 2026-10-07T14:40:00+05:30. -->

<!-- Automated README history sample f2a14e14/73/2; assigned commit date 2026-10-07T15:37:00+05:30. -->

<!-- Automated README history sample f2a14e14/73/3; assigned commit date 2026-10-07T16:59:00+05:30. -->

<!-- Automated README history sample f2a14e14/74/1; assigned commit date 2026-10-07T17:14:00+05:30. -->

<!-- Automated README history sample f2a14e14/74/2; assigned commit date 2026-10-08T09:25:00+05:30. -->

<!-- Automated README history sample f2a14e14/74/3; assigned commit date 2026-10-08T10:39:00+05:30. -->

<!-- Automated README history sample f2a14e14/75/1; assigned commit date 2026-10-08T11:46:00+05:30. -->

<!-- Automated README history sample f2a14e14/75/2; assigned commit date 2026-10-08T12:24:00+05:30. -->

<!-- Automated README history sample f2a14e14/76/1; assigned commit date 2026-10-08T13:31:00+05:30. -->

<!-- Automated README history sample f2a14e14/76/2; assigned commit date 2026-10-08T14:52:00+05:30. -->

<!-- Automated README history sample f2a14e14/76/3; assigned commit date 2026-10-08T15:09:00+05:30. -->

<!-- Automated README history sample f2a14e14/77/1; assigned commit date 2026-10-08T16:43:00+05:30. -->

<!-- Automated README history sample f2a14e14/77/2; assigned commit date 2026-10-08T17:47:00+05:30. -->

<!-- Automated README history sample f2a14e14/78/1; assigned commit date 2026-10-08T18:14:00+05:30. -->

<!-- Automated README history sample f2a14e14/78/2; assigned commit date 2026-10-09T09:27:00+05:30. -->

<!-- Automated README history sample f2a14e14/78/3; assigned commit date 2026-10-09T10:48:00+05:30. -->

<!-- Automated README history sample f2a14e14/79/1; assigned commit date 2026-10-09T11:19:00+05:30. -->

<!-- Automated README history sample f2a14e14/79/2; assigned commit date 2026-10-09T12:09:00+05:30. -->

<!-- Automated README history sample f2a14e14/79/3; assigned commit date 2026-10-09T13:38:00+05:30. -->

<!-- Automated README history sample f2a14e14/80/1; assigned commit date 2026-10-09T14:49:00+05:30. -->

<!-- Automated README history sample f2a14e14/80/2; assigned commit date 2026-10-09T15:07:00+05:30. -->

<!-- Automated README history sample f2a14e14/81/1; assigned commit date 2026-10-09T16:59:00+05:30. -->

<!-- Automated README history sample f2a14e14/81/2; assigned commit date 2026-10-12T09:27:00+05:30. -->

<!-- Automated README history sample f2a14e14/81/3; assigned commit date 2026-10-12T10:55:00+05:30. -->

<!-- Automated README history sample f2a14e14/82/1; assigned commit date 2026-10-12T11:18:00+05:30. -->

<!-- Automated README history sample f2a14e14/82/2; assigned commit date 2026-10-12T12:33:00+05:30. -->

<!-- Automated README history sample f2a14e14/83/1; assigned commit date 2026-10-12T13:02:00+05:30. -->

<!-- Automated README history sample f2a14e14/83/2; assigned commit date 2026-10-12T14:44:00+05:30. -->

<!-- Automated README history sample f2a14e14/83/3; assigned commit date 2026-10-12T15:46:00+05:30. -->

<!-- Automated README history sample f2a14e14/84/1; assigned commit date 2026-10-12T16:07:00+05:30. -->

<!-- Automated README history sample f2a14e14/84/2; assigned commit date 2026-10-13T09:26:00+05:30. -->

<!-- Automated README history sample f2a14e14/84/3; assigned commit date 2026-10-13T10:08:00+05:30. -->

<!-- Automated README history sample f2a14e14/85/1; assigned commit date 2026-10-13T11:21:00+05:30. -->

<!-- Automated README history sample f2a14e14/85/2; assigned commit date 2026-10-13T12:18:00+05:30. -->

<!-- Automated README history sample f2a14e14/86/1; assigned commit date 2026-10-13T13:18:00+05:30. -->

<!-- Automated README history sample f2a14e14/86/2; assigned commit date 2026-10-13T14:44:00+05:30. -->

<!-- Automated README history sample f2a14e14/86/3; assigned commit date 2026-10-14T09:11:00+05:30. -->

<!-- Automated README history sample f2a14e14/87/1; assigned commit date 2026-10-14T10:04:00+05:30. -->

<!-- Automated README history sample f2a14e14/87/2; assigned commit date 2026-10-14T11:58:00+05:30. -->

<!-- Automated README history sample f2a14e14/88/1; assigned commit date 2026-10-14T12:30:00+05:30. -->

<!-- Automated README history sample f2a14e14/88/2; assigned commit date 2026-10-14T13:16:00+05:30. -->

<!-- Automated README history sample f2a14e14/88/3; assigned commit date 2026-10-14T14:48:00+05:30. -->

<!-- Automated README history sample f2a14e14/89/1; assigned commit date 2026-10-14T15:17:00+05:30. -->

<!-- Automated README history sample f2a14e14/89/2; assigned commit date 2026-10-14T16:10:00+05:30. -->

<!-- Automated README history sample f2a14e14/89/3; assigned commit date 2026-10-15T09:31:00+05:30. -->

<!-- Automated README history sample f2a14e14/90/1; assigned commit date 2026-10-15T10:05:00+05:30. -->

<!-- Automated README history sample f2a14e14/90/2; assigned commit date 2026-10-15T11:10:00+05:30. -->

<!-- Automated README history sample f2a14e14/91/1; assigned commit date 2026-10-15T12:22:00+05:30. -->

<!-- Automated README history sample f2a14e14/91/2; assigned commit date 2026-10-15T13:08:00+05:30. -->

<!-- Automated README history sample f2a14e14/91/3; assigned commit date 2026-10-15T14:03:00+05:30. -->

<!-- Automated README history sample f2a14e14/92/1; assigned commit date 2026-10-15T15:48:00+05:30. -->

<!-- Automated README history sample f2a14e14/92/2; assigned commit date 2026-10-15T16:43:00+05:30. -->

<!-- Automated README history sample f2a14e14/93/1; assigned commit date 2026-10-15T17:15:00+05:30. -->

<!-- Automated README history sample f2a14e14/93/2; assigned commit date 2026-10-16T09:27:00+05:30. -->

<!-- Automated README history sample f2a14e14/93/3; assigned commit date 2026-10-16T10:31:00+05:30. -->

<!-- Automated README history sample f2a14e14/94/1; assigned commit date 2026-10-16T11:12:00+05:30. -->

<!-- Automated README history sample f2a14e14/94/2; assigned commit date 2026-10-16T12:46:00+05:30. -->

<!-- Automated README history sample f2a14e14/94/3; assigned commit date 2026-10-16T13:20:00+05:30. -->

<!-- Automated README history sample f2a14e14/95/1; assigned commit date 2026-10-19T09:10:00+05:30. -->

<!-- Automated README history sample f2a14e14/95/2; assigned commit date 2026-10-19T10:56:00+05:30. -->

<!-- Automated README history sample f2a14e14/96/1; assigned commit date 2026-10-19T11:21:00+05:30. -->

<!-- Automated README history sample f2a14e14/96/2; assigned commit date 2026-10-19T12:09:00+05:30. -->

<!-- Automated README history sample f2a14e14/96/3; assigned commit date 2026-10-19T13:30:00+05:30. -->

<!-- Automated README history sample f2a14e14/97/1; assigned commit date 2026-10-19T14:38:00+05:30. -->

<!-- Automated README history sample f2a14e14/97/2; assigned commit date 2026-10-20T09:55:00+05:30. -->

<!-- Automated README history sample f2a14e14/97/3; assigned commit date 2026-10-20T10:49:00+05:30. -->

<!-- Automated README history sample f2a14e14/98/1; assigned commit date 2026-10-20T11:01:00+05:30. -->

<!-- Automated README history sample f2a14e14/98/2; assigned commit date 2026-10-20T12:25:00+05:30. -->

<!-- Automated README history sample f2a14e14/99/1; assigned commit date 2026-10-20T13:24:00+05:30. -->

<!-- Automated README history sample f2a14e14/99/2; assigned commit date 2026-10-21T09:32:00+05:30. -->

<!-- Automated README history sample f2a14e14/99/3; assigned commit date 2026-10-21T10:38:00+05:30. -->

<!-- Automated README history sample f2a14e14/100/1; assigned commit date 2026-10-21T11:58:00+05:30. -->

<!-- Automated README history sample f2a14e14/100/2; assigned commit date 2026-10-21T12:14:00+05:30. -->

<!-- Automated README history sample f2a14e14/101/1; assigned commit date 2026-10-21T13:31:00+05:30. -->

<!-- Automated README history sample f2a14e14/101/2; assigned commit date 2026-10-21T14:46:00+05:30. -->

<!-- Automated README history sample f2a14e14/101/3; assigned commit date 2026-10-21T15:55:00+05:30. -->

<!-- Automated README history sample f2a14e14/102/1; assigned commit date 2026-10-21T16:24:00+05:30. -->

<!-- Automated README history sample f2a14e14/102/2; assigned commit date 2026-10-21T17:24:00+05:30. -->

<!-- Automated README history sample f2a14e14/102/3; assigned commit date 2026-10-22T09:24:00+05:30. -->

<!-- Automated README history sample f2a14e14/103/1; assigned commit date 2026-10-22T10:45:00+05:30. -->

<!-- Automated README history sample f2a14e14/103/2; assigned commit date 2026-10-22T11:58:00+05:30. -->

<!-- Automated README history sample f2a14e14/104/1; assigned commit date 2026-10-22T12:39:00+05:30. -->

<!-- Automated README history sample f2a14e14/104/2; assigned commit date 2026-10-22T13:53:00+05:30. -->

<!-- Automated README history sample f2a14e14/104/3; assigned commit date 2026-10-23T09:00:00+05:30. -->

<!-- Automated README history sample f2a14e14/105/1; assigned commit date 2026-10-23T10:54:00+05:30. -->
