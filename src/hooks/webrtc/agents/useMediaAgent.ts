import { useCallback } from "react";
import { useStableMemory } from "../memory/useWebRTCMemory";
import { BLUETOOTH_AUDIO_CONSTRAINTS } from "../tools/sdpTools";
import { VideoQuality } from "../types";

/** Video quality presets — resolution and bitrate constraints */
const VIDEO_QUALITY_PRESETS: Record<
  VideoQuality,
  MediaTrackConstraints | false
> = {
  high: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  medium: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 24 },
  },
  low: {
    width: { ideal: 320 },
    height: { ideal: 240 },
    frameRate: { ideal: 15 },
  },
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

  const emitLocalMediaState = useCallback(
    (overrides: {
      isMuted?: boolean;
      isVideoEnabled?: boolean;
      isSharingScreen?: boolean;
      cameraStreamId?: string;
      screenStreamId?: string;
    } = {}) => {
      const memory = memoryRef.current;
      memory.socketRef.current?.emit("user-media-state", {
        isMuted: overrides.isMuted ?? memory.isMuted,
        isVideoEnabled: overrides.isVideoEnabled ?? memory.isVideoEnabled,
        isSharingScreen: overrides.isSharingScreen ?? memory.isSharingScreen,
        ...(overrides.cameraStreamId ? { cameraStreamId: overrides.cameraStreamId } : {}),
        ...(overrides.screenStreamId ? { screenStreamId: overrides.screenStreamId } : {}),
      });
    },
    [memoryRef],
  );

  const clearSender = useCallback(
    (peer: { connection: RTCPeerConnection }, sender?: RTCRtpSender) => {
      if (!sender) return;
      try {
        if (peer.connection.signalingState !== "closed") {
          peer.connection.removeTrack(sender);
        }
      } catch (err) {
        console.warn("[Media] Failed to remove sender:", err);
      }
    },
    [],
  );

  const clearCamera = useCallback(() => {
    const memory = memoryRef.current;
    const cameraStream = memory.videoStreamRef.current;

    memory.videoStreamRef.current = null;
    memory.setLocalVideoStream(null);
    cameraStream?.getTracks().forEach((track) => {
      track.onended = null;
      if (track.readyState !== "ended") track.stop();
    });

    memory.peersRef.current.forEach((peer, peerId) => {
      const senders = memory.senderMapRef.current.get(peerId);
      clearSender(peer, senders?.cameraSender);
      if (senders) {
        delete senders.cameraSender;
        memory.senderMapRef.current.set(peerId, senders);
      }
    });

    memory.setIsVideoEnabled(false);
  }, [clearSender, memoryRef]);

  const clearScreenShare = useCallback(() => {
    const memory = memoryRef.current;
    const screenStream = memory.screenStreamRef.current;

    memory.screenStreamRef.current = null;
    memory.setLocalScreenStream(null);
    screenStream?.getTracks().forEach((track) => {
      track.onended = null;
      if (track.readyState !== "ended") track.stop();
    });

    memory.peersRef.current.forEach((peer, peerId) => {
      const senders = memory.senderMapRef.current.get(peerId);
      clearSender(peer, senders?.screenSender);
      if (senders) {
        delete senders.screenSender;
        memory.senderMapRef.current.set(peerId, senders);
      }
    });

    memory.setIsSharingScreen(false);
  }, [clearSender, memoryRef]);

  const toggleMute = useCallback(() => {
    const memory = memoryRef.current;
    if (memory.localStreamRef.current) {
      const audioTrack = memory.localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        memory.setIsMuted(newMuted);

        emitLocalMediaState({ isMuted: newMuted });
      }
    }
  }, [emitLocalMediaState, memoryRef]);

  /**
   * Toggle camera video on/off.
   * - On: Acquires camera stream, adds video track to all peer connections.
   * - Off: Stops camera stream, removes video track from all peer connections.
   */
  const toggleVideo = useCallback(async () => {
    const memory = memoryRef.current;
    const currentlyEnabled = !!memory.videoStreamRef.current;

    if (currentlyEnabled) {
      clearCamera();
      emitLocalMediaState({ isVideoEnabled: false });
      memory.addActivity({
        type: "video-off",
        userName: "You",
        timestamp: Date.now(),
      });
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
        memory.peersRef.current.forEach((peer, peerId) => {
          const sender = peer.connection.addTrack(videoTrack, videoStream);
          const senders = memory.senderMapRef.current.get(peerId) || {};
          senders.cameraSender = sender;
          memory.senderMapRef.current.set(peerId, senders);
        });

        // Auto-stop if track ends externally
        videoTrack.onended = () => {
          clearCamera();
          emitLocalMediaState({ isVideoEnabled: false });
        };

        memory.setIsVideoEnabled(true);
        emitLocalMediaState({
          isVideoEnabled: true,
          cameraStreamId: videoStream.id,
        });
        memory.addActivity({
          type: "video-on",
          userName: "You",
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("[Video] Camera access failed:", err);
      }
    }
  }, [clearCamera, emitLocalMediaState, memoryRef]);

  /**
   * Switch between front/back cameras (mobile) or different camera devices.
   */
  const switchCamera = useCallback(
    async (deviceId?: string) => {
      const memory = memoryRef.current;

      if (!memory.videoStreamRef.current) {
        console.warn("[Video] No active video stream to switch camera");
        return;
      }

      try {
        let targetDeviceId = deviceId;
        if (!targetDeviceId) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          if (videoDevices.length < 2) return;

          const currentTrack =
            memory.videoStreamRef.current.getVideoTracks()[0];
          const currentDeviceId = currentTrack.getSettings().deviceId;
          const currentIndex = videoDevices.findIndex(
            (d) => d.deviceId === currentDeviceId,
          );
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

        const newTrack = newStream.getVideoTracks()[0];
        const oldStream = memory.videoStreamRef.current;
        memory.videoStreamRef.current = newStream;
        memory.setLocalVideoStream(newStream);
        memory.setCurrentCameraId(targetDeviceId);

        oldStream?.getTracks().forEach((track) => {
          track.onended = null;
          if (track.readyState !== "ended") track.stop();
        });

        // Replace track on all peer connections
        memory.peersRef.current.forEach((peer, peerId) => {
          const senders = memory.senderMapRef.current.get(peerId);
          if (senders?.cameraSender) {
            senders.cameraSender.replaceTrack(newTrack);
          }
        });

        newTrack.onended = () => {
          clearCamera();
          emitLocalMediaState({ isVideoEnabled: false });
        };
      } catch (err) {
        console.error("[Video] Camera switch failed:", err);
      }
    },
    [clearCamera, emitLocalMediaState, memoryRef],
  );

  const setVideoQuality = useCallback(
    async (quality: VideoQuality) => {
      const memory = memoryRef.current;
      memory.setVideoQuality(quality);

      const bitrateCap = VIDEO_BITRATE_CAPS[quality];
      memory.peersRef.current.forEach((peer, peerId) => {
        const senders = memory.senderMapRef.current.get(peerId);
        if (senders?.cameraSender) {
          try {
            const params = senders.cameraSender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = bitrateCap;
            senders.cameraSender.setParameters(params);
          } catch (err) {
            console.warn("[Video] Failed to set bitrate:", err);
          }
        }
      });

      if (memory.videoStreamRef.current && quality !== "off") {
        const constraints = VIDEO_QUALITY_PRESETS[quality];
        if (!constraints) return;

        const currentTrack = memory.videoStreamRef.current.getVideoTracks()[0];
        try {
          await currentTrack.applyConstraints(constraints);
        } catch (err) {
          console.warn(
            "[Video] Failed to apply constraints, re-acquiring:",
            err,
          );
          await switchCamera(memory.currentCameraId || undefined);
        }
      }
    },
    [memoryRef, switchCamera],
  );

  const toggleScreenShare = useCallback(async () => {
    const memory = memoryRef.current;
    const currentlySharing = !!memory.screenStreamRef.current;

    if (currentlySharing) {
      clearScreenShare();
      emitLocalMediaState({ isSharingScreen: false });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as MediaTrackConstraints,
          audio: false,
        });

        memory.screenStreamRef.current = screenStream;
        memory.setLocalScreenStream(screenStream);

        const videoTrack = screenStream.getVideoTracks()[0];
        memory.peersRef.current.forEach((peer, peerId) => {
          const sender = peer.connection.addTrack(videoTrack, screenStream);
          const senders = memory.senderMapRef.current.get(peerId) || {};
          senders.screenSender = sender;
          memory.senderMapRef.current.set(peerId, senders);
        });

        videoTrack.onended = () => {
          clearScreenShare();
          emitLocalMediaState({ isSharingScreen: false });
        };

        memory.setIsSharingScreen(true);
        emitLocalMediaState({
          isSharingScreen: true,
          screenStreamId: screenStream.id,
        });
      } catch (err) {
        console.error("[Screen] Share failed:", err);
      }
    }
  }, [clearScreenShare, emitLocalMediaState, memoryRef]);

  const switchAudioDevice = useCallback(
    async (deviceId: string) => {
      const memory = memoryRef.current;
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...BLUETOOTH_AUDIO_CONSTRAINTS,
            deviceId: { exact: deviceId },
          },
        });

        const oldStream = memory.localStreamRef.current;
        if (oldStream) {
          oldStream.getTracks().forEach((t) => t.stop());
        }

        memory.localStreamRef.current = newStream;
        memory.setLocalStream(newStream);

        const newTrack = newStream.getAudioTracks()[0];
        const currentTrack = oldStream?.getAudioTracks()[0];
        if (currentTrack && !currentTrack.enabled) {
          newTrack.enabled = false;
        }

        memory.peersRef.current.forEach((peer) => {
          const sender = peer.connection
            .getSenders()
            .find((s) => s.track && s.track.kind === "audio");
          if (sender) {
            sender.replaceTrack(newTrack);
          }
        });
      } catch (err) {
        console.error("Failed to switch actual audio device:", err);
      }
    },
    [memoryRef],
  );

  return {
    toggleMute,
    toggleVideo,
    switchCamera,
    setVideoQuality,
    toggleScreenShare,
    switchAudioDevice,
  };
}
