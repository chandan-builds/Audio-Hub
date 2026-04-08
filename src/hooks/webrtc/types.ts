export interface PeerData {
  userId: string;
  userName: string;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  connection: RTCPeerConnection;
  isMuted: boolean;
  isSharingScreen: boolean;
  connectionState: RTCIceConnectionState;
  audioLevel: number;
}

export interface ChatMessage {
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  isLocal?: boolean;
}

export interface ActivityEvent {
  type: "join" | "leave" | "mute" | "unmute" | "screen-share" | "screen-stop" | "chat";
  userName: string;
  timestamp: number;
}

export interface WebRTCContextState {
  peers: Map<string, PeerData>;
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  isMuted: boolean;
  isSharingScreen: boolean;
  isConnected: boolean;
  chatMessages: ChatMessage[];
  activityLog: ActivityEvent[];
  roomUserCount: number;
}
