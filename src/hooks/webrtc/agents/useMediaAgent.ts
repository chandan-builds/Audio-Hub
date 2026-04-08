import { useCallback } from "react";
import { useWebRTCMemory } from "../memory/useWebRTCMemory";

export function useMediaAgent() {
  const memory = useWebRTCMemory();

  const toggleMute = useCallback(() => {
    if (memory.localStreamRef.current) {
      const audioTrack = memory.localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        memory.setIsMuted(newMuted);
        memory.socketRef.current?.emit("user-muted", newMuted);
      }
    }
  }, [memory]);

  const toggleScreenShare = useCallback(async () => {
    if (memory.isSharingScreen) {
      memory.screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      memory.screenStreamRef.current = null;
      memory.setLocalScreenStream(null);

      memory.peersRef.current.forEach((peer) => {
        const senders = peer.connection.getSenders();
        senders.forEach((sender) => {
          if (sender.track?.kind === "video") {
            peer.connection.removeTrack(sender);
          }
        });
      });

      memory.setIsSharingScreen(false);
      memory.socketRef.current?.emit("user-screen-share", false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as MediaTrackConstraints,
          audio: false,
        });

        memory.screenStreamRef.current = screenStream;
        memory.setLocalScreenStream(screenStream);

        const videoTrack = screenStream.getVideoTracks()[0];
        memory.peersRef.current.forEach((peer) => {
          peer.connection.addTrack(videoTrack, screenStream);
        });

        videoTrack.onended = () => {
          memory.screenStreamRef.current?.getTracks().forEach((t) => t.stop());
          memory.screenStreamRef.current = null;
          memory.setLocalScreenStream(null);

          memory.peersRef.current.forEach((peer) => {
            const senders = peer.connection.getSenders();
            senders.forEach((sender) => {
              if (sender.track?.kind === "video") {
                peer.connection.removeTrack(sender);
              }
            });
          });

          memory.setIsSharingScreen(false);
          memory.socketRef.current?.emit("user-screen-share", false);
        };

        memory.setIsSharingScreen(true);
        memory.socketRef.current?.emit("user-screen-share", true);
      } catch (err) {
        console.error("[Screen] Share failed:", err);
      }
    }
  }, [memory]);

  const switchAudioDevice = useCallback(async (deviceId: string) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });
      
      const oldStream = memory.localStreamRef.current;
      if (oldStream) {
        oldStream.getTracks().forEach(t => t.stop());
      }
      
      memory.localStreamRef.current = newStream;
      memory.setLocalStream(newStream);
      
      const newTrack = newStream.getAudioTracks()[0];
      if (memory.isMuted) {
        newTrack.enabled = false;
      }

      memory.peersRef.current.forEach(peer => {
        const sender = peer.connection.getSenders().find(s => s.track && s.track.kind === "audio");
        if (sender) {
          sender.replaceTrack(newTrack);
        }
      });
    } catch (err) {
      console.error("Failed to switch actual audio device:", err);
    }
  }, [memory]);

  return {
    toggleMute,
    toggleScreenShare,
    switchAudioDevice
  };
}
