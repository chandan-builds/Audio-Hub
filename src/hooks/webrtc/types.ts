export type VideoQuality = 'high' | 'medium' | 'low' | 'off';

export interface PeerData {
  userId: string;
  userName: string;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  videoStream: MediaStream | null;
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
  type: "join" | "leave" | "mute" | "unmute" | "screen-share" | "screen-stop" | "chat" | "video-on" | "video-off";
  userName: string;
  timestamp: number;
}

export interface WebRTCContextState {
  peers: Map<string, PeerData>;
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  localVideoStream: MediaStream | null;
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
}
