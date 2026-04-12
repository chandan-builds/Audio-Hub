import { usePeerAgent } from "./agents/usePeerAgent";
import { useMediaAgent } from "./agents/useMediaAgent";
import { useSignalingAgent } from "./agents/useSignalingAgent";

export interface UseWebRTCCoordinatorOptions {
  roomId: string;
  userId: string;
  userName: string;
  serverUrl: string;
  /** Preferred microphone device ID captured on the pre-join screen */
  preferredAudioInputId?: string;
  /** Preferred camera device ID captured on the pre-join screen */
  preferredVideoInputId?: string;
  /** Preferred speaker device ID captured on the pre-join screen */
  preferredAudioOutputId?: string;
  /** Whether the user chose to join muted */
  startMuted?: boolean;
  /** Whether the user chose to join with camera off */
  startVideoOff?: boolean;
  /** Called when getUserMedia fails — returns a PermissionError type string */
  onPermissionError?: (err: string) => void;
}

/**
 * The Coordinator hook that initializes and boots up the three primary WebRTC agents.
 * This must be called from deeply within a component that is wrapped in `WebRTCProvider`.
 */
export function useWebRTCCoordinator({
  roomId,
  userId,
  userName,
  serverUrl,
  preferredAudioInputId,
  startMuted,
  onPermissionError,
}: UseWebRTCCoordinatorOptions) {
  const peerAgent = usePeerAgent({ userId, userName });
  const mediaAgent = useMediaAgent();
  const signalingAgent = useSignalingAgent({
    roomId,
    userId,
    userName,
    serverUrl,
    preferredAudioInputId,
    startMuted,
    createPeerConnection: peerAgent.createPeerConnection,
    cleanupPeer: peerAgent.cleanupPeer,
    flushIceCandidates: peerAgent.flushIceCandidates,
    setupAudioAnalyser: peerAgent.setupAudioAnalyser,
    onPermissionError,
  });

  return {
    // Media controls
    toggleMute: mediaAgent.toggleMute,
    toggleVideo: mediaAgent.toggleVideo,
    toggleScreenShare: mediaAgent.toggleScreenShare,
    switchCamera: mediaAgent.switchCamera,
    switchAudioDevice: mediaAgent.switchAudioDevice,
    setVideoQuality: mediaAgent.setVideoQuality,
    // Signaling controls
    sendChatMessage: signalingAgent.sendChatMessage,
    disconnect: signalingAgent.disconnect,
    triggerHostAction: signalingAgent.triggerHostAction,
    // Peer controls
    createPeerConnection: peerAgent.createPeerConnection,
    cleanupPeer: peerAgent.cleanupPeer,
    flushIceCandidates: peerAgent.flushIceCandidates,
    setupAudioAnalyser: peerAgent.setupAudioAnalyser,
  };
}
