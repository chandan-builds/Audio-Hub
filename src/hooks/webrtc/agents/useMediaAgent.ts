import { useCallback } from "react";
import { useStableMemory } from "../memory/useWebRTCMemory";
import { BLUETOOTH_AUDIO_CONSTRAINTS } from "../tools/sdpTools";
import { VideoQuality } from "../types";

/** Video quality presets — resolution and bitrate constraints */
const VIDEO_QUALITY_PRESETS: Record<VideoQuality, MediaTrackConstraints | false> = {
  high: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  medium: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
  low: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } },
  off: false,
};

/** Bitrate caps per quality level (bps) */
const VIDEO_BITRATE_CAPS: Record<VideoQuality, number> = {
  high: 1_500_000,
  medium: 600_000,
  low: 200_000,
  off: 0,
};

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

  /**
   * Toggle camera video on/off.
   * - On: Acquires camera stream, adds video track to all peer connections.
   * - Off: Stops camera stream, removes video track from all peer connections.
   * Uses replaceTrack where possible to avoid renegotiation.
   */
  const toggleVideo = useCallback(async () => {
    const memory = memoryRef.current;
    const currentlyEnabled = !!memory.videoStreamRef.current;

    if (currentlyEnabled) {
      // Stop video
      memory.videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      memory.videoStreamRef.current = null;
      memory.setLocalVideoStream(null);

      // Remove video senders from all peers (camera tracks only, not screen share)
      memory.peersRef.current.forEach((peer) => {
        const senders = peer.connection.getSenders();
        senders.forEach((sender) => {
          if (sender.track?.kind === "video") {
            // Only remove if this sender's track came from our camera (not screen share)
            const screenTrack = memory.screenStreamRef.current?.getVideoTracks()[0];
            if (!screenTrack || sender.track.id !== screenTrack.id) {
              peer.connection.removeTrack(sender);
            }
          }
        });
      });

      memory.setIsVideoEnabled(false);
      memory.socketRef.current?.emit("user-video", false);
      memory.addActivity({ type: "video-off", userName: "You", timestamp: Date.now() });
    } else {
      try {
        const quality = memory.videoQuality;
        const constraints = VIDEO_QUALITY_PRESETS[quality];
        if (!constraints) return;

        const cameraId = memory.currentCameraId;
        const videoConstraints: MediaTrackConstraints = {
          ...constraints,
          ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
        };

        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        memory.videoStreamRef.current = videoStream;
        memory.setLocalVideoStream(videoStream);

        const videoTrack = videoStream.getVideoTracks()[0];

        // Add video track to all existing peer connections
        memory.peersRef.current.forEach((peer) => {
          peer.connection.addTrack(videoTrack, videoStream);
        });

        // Auto-stop if track ends externally (e.g., permission revoked)
        videoTrack.onended = () => {
          const mem = memoryRef.current;
          mem.videoStreamRef.current = null;
          mem.setLocalVideoStream(null);
          mem.setIsVideoEnabled(false);
          mem.socketRef.current?.emit("user-video", false);
        };

        memory.setIsVideoEnabled(true);
        memory.socketRef.current?.emit("user-video", true);
        memory.addActivity({ type: "video-on", userName: "You", timestamp: Date.now() });
      } catch (err) {
        console.error("[Video] Camera access failed:", err);
      }
    }
  }, [memoryRef]);

  /**
   * Switch between front/back cameras (mobile) or different camera devices.
   * Uses replaceTrack to avoid renegotiation — seamless switch.
   */
  const switchCamera = useCallback(async (deviceId?: string) => {
    const memory = memoryRef.current;
    
    if (!memory.videoStreamRef.current) {
      console.warn("[Video] No active video stream to switch camera");
      return;
    }

    try {
      // If no specific deviceId, find the next camera in the list
      let targetDeviceId = deviceId;
      if (!targetDeviceId) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === "videoinput");
        if (videoDevices.length < 2) return; // Nothing to switch to

        const currentTrack = memory.videoStreamRef.current.getVideoTracks()[0];
        const currentDeviceId = currentTrack.getSettings().deviceId;
        const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        targetDeviceId = videoDevices[nextIndex].deviceId;
      }

      const quality = memory.videoQuality;
      const constraints = VIDEO_QUALITY_PRESETS[quality];
      if (!constraints) return;

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { ...constraints, deviceId: { exact: targetDeviceId } },
        audio: false,
      });

      // Stop old tracks
      memory.videoStreamRef.current.getTracks().forEach(t => t.stop());

      const newTrack = newStream.getVideoTracks()[0];
      memory.videoStreamRef.current = newStream;
      memory.setLocalVideoStream(newStream);
      memory.setCurrentCameraId(targetDeviceId);

      // Replace track on all peer connections — no renegotiation needed!
      memory.peersRef.current.forEach((peer) => {
        const sender = peer.connection.getSenders().find(s => {
          if (!s.track || s.track.kind !== "video") return false;
          // Don't touch screen share senders
          const screenTrack = memory.screenStreamRef.current?.getVideoTracks()[0];
          return !screenTrack || s.track.id !== screenTrack.id;
        });
        if (sender) {
          sender.replaceTrack(newTrack);
        }
      });

      newTrack.onended = () => {
        const mem = memoryRef.current;
        mem.videoStreamRef.current = null;
        mem.setLocalVideoStream(null);
        mem.setIsVideoEnabled(false);
        mem.socketRef.current?.emit("user-video", false);
      };
    } catch (err) {
      console.error("[Video] Camera switch failed:", err);
    }
  }, [memoryRef]);

  /**
   * Adaptive video quality control.
   * Adjusts resolution + bitrate dynamically based on peer count or manual selection.
   */
  const setVideoQuality = useCallback(async (quality: VideoQuality) => {
    const memory = memoryRef.current;
    memory.setVideoQuality(quality);

    // Apply bitrate cap to all video senders
    const bitrateCap = VIDEO_BITRATE_CAPS[quality];
    memory.peersRef.current.forEach((peer) => {
      peer.connection.getSenders().forEach(async (sender) => {
        if (sender.track?.kind === "video") {
          const screenTrack = memory.screenStreamRef.current?.getVideoTracks()[0];
          if (screenTrack && sender.track.id === screenTrack.id) return; // Skip screen share

          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = bitrateCap;
            await sender.setParameters(params);
          } catch (err) {
            console.warn("[Video] Failed to set bitrate:", err);
          }
        }
      });
    });

    // If video is active, re-acquire with new constraints
    if (memory.videoStreamRef.current && quality !== 'off') {
      const constraints = VIDEO_QUALITY_PRESETS[quality];
      if (!constraints) return;

      const currentTrack = memory.videoStreamRef.current.getVideoTracks()[0];
      try {
        await currentTrack.applyConstraints(constraints);
      } catch (err) {
        console.warn("[Video] Failed to apply constraints, re-acquiring:", err);
        // Fallback: re-acquire camera
        await switchCamera(memory.currentCameraId || undefined);
      }
    }
  }, [memoryRef, switchCamera]);

  const toggleScreenShare = useCallback(async () => {
    const memory = memoryRef.current;
    const currentlySharing = !!memory.screenStreamRef.current;

    if (currentlySharing) {
      memory.screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      memory.screenStreamRef.current = null;
      memory.setLocalScreenStream(null);

      memory.peersRef.current.forEach((peer) => {
        const senders = peer.connection.getSenders();
        senders.forEach((sender) => {
          if (sender.track?.kind === "video") {
            // Only remove screen share sender, not camera
            const cameraTrack = memory.videoStreamRef.current?.getVideoTracks()[0];
            if (!cameraTrack || sender.track.id !== cameraTrack.id) {
              peer.connection.removeTrack(sender);
            }
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
                const cameraTrack = mem.videoStreamRef.current?.getVideoTracks()[0];
                if (!cameraTrack || sender.track?.id !== cameraTrack.id) {
                  peer.connection.removeTrack(sender);
                }
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
    toggleVideo,
    switchCamera,
    setVideoQuality,
    toggleScreenShare,
    switchAudioDevice
  };
}
