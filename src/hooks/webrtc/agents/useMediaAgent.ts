import { useCallback } from "react";
import { useStableMemory } from "../memory/useWebRTCMemory";
import { BLUETOOTH_AUDIO_CONSTRAINTS } from "../tools/sdpTools";

export function useMediaAgent() {
  const memoryRef = useStableMemory();

  const toggleMute = useCallback(() => {
    const memory = memoryRef.current;
    if (memory.localStreamRef.current) {
      const audioTrack = memory.localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        memory.setIsMuted(newMuted);
        memory.socketRef.current?.emit("user-muted", newMuted);
      }
    }
  }, [memoryRef]);

  const toggleScreenShare = useCallback(async () => {
    const memory = memoryRef.current;
    // Use the ref to check current sharing state (stable, not stale)
    const currentlySharing = !!memory.screenStreamRef.current;

    if (currentlySharing) {
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
          const mem = memoryRef.current;
          mem.screenStreamRef.current?.getTracks().forEach((t) => t.stop());
          mem.screenStreamRef.current = null;
          mem.setLocalScreenStream(null);

          mem.peersRef.current.forEach((peer) => {
            const senders = peer.connection.getSenders();
            senders.forEach((sender) => {
              if (sender.track?.kind === "video") {
                peer.connection.removeTrack(sender);
              }
            });
          });

          mem.setIsSharingScreen(false);
          mem.socketRef.current?.emit("user-screen-share", false);
        };

        memory.setIsSharingScreen(true);
        memory.socketRef.current?.emit("user-screen-share", true);
      } catch (err) {
        console.error("[Screen] Share failed:", err);
      }
    }
  }, [memoryRef]);

  const switchAudioDevice = useCallback(async (deviceId: string) => {
    const memory = memoryRef.current;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...BLUETOOTH_AUDIO_CONSTRAINTS,
          deviceId: { exact: deviceId },
        }
      });
      
      const oldStream = memory.localStreamRef.current;
      if (oldStream) {
        oldStream.getTracks().forEach(t => t.stop());
      }
      
      memory.localStreamRef.current = newStream;
      memory.setLocalStream(newStream);
      
      const newTrack = newStream.getAudioTracks()[0];
      // Check actual track state instead of stale isMuted state
      const currentTrack = oldStream?.getAudioTracks()[0];
      if (currentTrack && !currentTrack.enabled) {
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
  }, [memoryRef]);

  return {
    toggleMute,
    toggleScreenShare,
    switchAudioDevice
  };
}
