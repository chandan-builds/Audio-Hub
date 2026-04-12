export type VideoQuality = "high" | "medium" | "low" | "off";

export type LayoutMode = "grid" | "speaker" | "pinned" | "presentation";
export type PanelTab = "chat" | "participants" | "activity" | null;
export type ConnectionQuality =
  | "excellent"
  | "good"
  | "poor"
  | "critical"
  | "unknown";
export type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  timestamp: number;
}

export interface ConnectionHealth {
  state: "connected" | "reconnecting" | "disconnected" | "failed";
  quality: ConnectionQuality;
  lastChecked: number;
}

export interface MediaPresentation {
  /** The primary video to display (screen share takes priority when active) */
  primaryStream: MediaStream | null;
  /** The secondary video (camera PiP when screen sharing) */
  secondaryStream: MediaStream | null;
  /** What's currently being shown as primary */
  primarySource: "camera" | "screen" | "none";
}

export interface PeerData {
  userId: string;
  userName: string;
  /** The peer's audio stream (always present once connected). */
  stream: MediaStream | null;
  /** Camera video stream — null when camera is off or not yet received. */
  cameraStream: MediaStream | null;
  /** Screen-share stream — null when not sharing or not yet received. */
  screenStream: MediaStream | null;
  /** Derived presentation — always computed via computePresentation(). Never mutated directly. */
  presentation: MediaPresentation;
  connection: RTCPeerConnection;
  isMuted: boolean;
  isSharingScreen: boolean;
  isVideoEnabled: boolean;
  connectionState: RTCIceConnectionState;
  audioLevel: number;
  isSpeaking: boolean;
  role?: "host" | "participant";
  isMutedByHost?: boolean;
  isVideoDisabledByHost?: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  isLocal?: boolean;
}

export interface ActivityEvent {
  type:
    | "join"
    | "leave"
    | "mute"
    | "unmute"
    | "screen-share"
    | "screen-stop"
    | "chat"
    | "video-on"
    | "video-off";
  userName: string;
  timestamp: number;
}

export interface WebRTCContextState {
  peers: Map<string, PeerData>;
  localStream: MediaStream | null;
  localPresentation: MediaPresentation;
  isMuted: boolean;
  isSharingScreen: boolean;
  isVideoEnabled: boolean;
  isConnected: boolean;
  chatMessages: ChatMessage[];
  activityLog: ActivityEvent[];
  roomUserCount: number;
  activeSpeakerId: string | null;
  currentCameraId: string | null;
  videoQuality: VideoQuality;
  userRole: "host" | "participant" | "unknown";
  isMutedByHost: boolean;
  isVideoDisabledByHost: boolean;
  // New Phase 1 state
  layoutMode: LayoutMode;
  activePanelTab: PanelTab;
  pinnedPeerId: string | null;
  toasts: Toast[];
  connectionHealth: ConnectionHealth;
  isRecording: boolean;
  unreadChatCount: number;
}
