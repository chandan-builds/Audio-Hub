import { useCallback, useEffect, useRef } from "react";
import { useStableMemory } from "../memory/useWebRTCMemory";
import { setOpusLowLatency, createLowLatencyAudioContext } from "../tools/sdpTools";
import { PeerData } from "../types";

/**
 * Stream ID label convention:
 * - Audio stream: default (no label) or "audio"
 * - Video (camera) stream: labeled "camera-video" via data channels or identified by track kind + no screen share
 * - Screen share stream: labeled "screen-share" or identified second video track
 * 
 * Strategy: We use transceiver mid / stream ID tracking to differentiate camera vs screen share.
 * The first video stream added to a peer is camera. Screen share uses addTrack with a separate MediaStream.
 */

interface UsePeerAgentOptions {
  userId: string;
  userName: string;
}

// Speaking detection threshold and debounce
const SPEAKING_THRESHOLD = 0.15;
const ACTIVE_SPEAKER_DEBOUNCE_MS = 300;

export function usePeerAgent({ userId, userName }: UsePeerAgentOptions) {
  const memoryRef = useStableMemory();
  const activeSpeakerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setupAudioAnalyser = useCallback(
    (stream: MediaStream, peerId: string) => {
      const memory = memoryRef.current;
      if (!memory.audioContextRef.current || memory.audioContextRef.current.state === "closed") {
        memory.audioContextRef.current = createLowLatencyAudioContext();
      }
      const ctx = memory.audioContextRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      memory.analyserNodesRef.current.set(peerId, analyser);
    },
    [memoryRef]
  );

  const cleanupPeer = useCallback((peerId: string) => {
    const memory = memoryRef.current;
    const peer = memory.peersRef.current.get(peerId);
    if (peer) {
      peer.connection.close();
      memory.peersRef.current.delete(peerId);
      memory.analyserNodesRef.current.delete(peerId);
      memory.iceCandidateBufferRef.current.delete(peerId);
      memory.makingOfferRef.current.delete(peerId);
      memory.negotiationDoneRef.current.delete(peerId);
      memory.politeRef.current.delete(peerId);
      memory.ignoreOfferRef.current.delete(peerId);
      memory.setPeers((prev) => {
        const updated = new Map(prev);
        updated.delete(peerId);
        return updated;
      });
    }
  }, [memoryRef]);

  const flushIceCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const memory = memoryRef.current;
    const buffered = memory.iceCandidateBufferRef.current.get(peerId);
    if (buffered && buffered.length > 0) {
      console.log(`[ICE] Flushing ${buffered.length} buffered candidates for ${peerId}`);
      for (const candidate of buffered) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("[ICE] Error adding buffered candidate:", err);
        }
      }
      memory.iceCandidateBufferRef.current.set(peerId, []);
    }
  }, [memoryRef]);

  const createPeerConnection = useCallback(
    (
      targetUserId: string,
      targetUserName: string,
      isInitiator: boolean
    ): RTCPeerConnection => {
      const memory = memoryRef.current;
      const pc = new RTCPeerConnection({
        iceServers: memory.iceServersRef.current,
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });

      // Initialize state for this peer
      memory.iceCandidateBufferRef.current.set(targetUserId, []);
      memory.makingOfferRef.current.set(targetUserId, false);
      memory.ignoreOfferRef.current.set(targetUserId, false);
      memory.negotiationDoneRef.current.set(targetUserId, false);
      
      // Perfect negotiation: the user who IS the initiator is IMPOLITE (polite = false).
      memory.politeRef.current.set(targetUserId, !isInitiator);

      // Add local audio tracks
      if (memory.localStreamRef.current) {
        memory.localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, memory.localStreamRef.current!);
        });
      }

      // Add local camera video track if we're currently sharing video
      if (memory.videoStreamRef.current) {
        const videoTrack = memory.videoStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          pc.addTrack(videoTrack, memory.videoStreamRef.current);
        }
      }

      // Add screen share track if we're currently sharing
      if (memory.screenStreamRef.current) {
        const videoTrack = memory.screenStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          pc.addTrack(videoTrack, memory.screenStreamRef.current);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          memory.socketRef.current?.emit("signal", {
            to: targetUserId,
            from: userId,
            fromName: userName,
            signal: event.candidate,
            type: "candidate",
          });
        }
      };

      /**
       * Track differentiation strategy:
       * We track which video stream IDs we've seen per peer.
       * - First video stream → camera video
       * - Second video stream → screen share
       * 
       * When a peer stops screen share (track.onended), we clean it up.
       * When a peer stops camera (track.onended), we clean it up.
       */
      const videoStreamIds = new Set<string>();

      pc.ontrack = (event) => {
        console.log(`[WebRTC] ontrack from ${targetUserName}, kind=${event.track.kind}, streams=${event.streams.length}`);
        const incomingStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);

        if (event.track.kind === "audio") {
          setupAudioAnalyser(incomingStream, targetUserId);
          
          memory.setPeers((prev) => {
            const updated = new Map<string, PeerData>(prev);
            const existing = updated.get(targetUserId);
            const peerData: PeerData = {
              userId: targetUserId,
              userName: targetUserName,
              stream: incomingStream,
              screenStream: existing?.screenStream ?? null,
              videoStream: existing?.videoStream ?? null,
              connection: pc,
              isMuted: existing?.isMuted ?? false,
              isSharingScreen: existing?.isSharingScreen ?? false,
              isVideoEnabled: existing?.isVideoEnabled ?? false,
              connectionState: pc.iceConnectionState,
              audioLevel: 0,
              isSpeaking: false,
            };
            updated.set(targetUserId, peerData);
            return updated;
          });
          
          const existingRef = memory.peersRef.current.get(targetUserId);
          memory.peersRef.current.set(targetUserId, {
            ...(existingRef as PeerData),
            userId: targetUserId,
            userName: targetUserName,
            stream: incomingStream,
            screenStream: existingRef?.screenStream ?? null,
            videoStream: existingRef?.videoStream ?? null,
            connection: pc,
            isMuted: existingRef?.isMuted ?? false,
            isSharingScreen: existingRef?.isSharingScreen ?? false,
            isVideoEnabled: existingRef?.isVideoEnabled ?? false,
            connectionState: pc.iceConnectionState,
            audioLevel: existingRef?.audioLevel ?? 0,
            isSpeaking: existingRef?.isSpeaking ?? false,
          });
        } else if (event.track.kind === "video") {
          const streamId = incomingStream.id;
          const isNewVideoStream = !videoStreamIds.has(streamId);

          if (isNewVideoStream) {
            videoStreamIds.add(streamId);
          }

          // Determine if this is camera or screen share based on existing state
          const existingPeer = memory.peersRef.current.get(targetUserId);
          const hasExistingVideo = existingPeer?.videoStream && existingPeer.videoStream.id !== streamId;
          const hasExistingScreen = existingPeer?.screenStream && existingPeer.screenStream.id !== streamId;

          // If peer already has a camera video and this is a new stream → it's screen share
          // If peer has no camera video → first stream is camera, unless peer signals screen share
          const isScreenShare = hasExistingVideo || (existingPeer?.isSharingScreen && !hasExistingScreen);

          if (isScreenShare) {
            // This is a screen share stream
            memory.setPeers((prev) => {
              const existing = prev.get(targetUserId);
              if (existing && existing.screenStream?.id !== streamId) {
                const updated = new Map<string, PeerData>(prev);
                updated.set(targetUserId, {
                  ...existing,
                  screenStream: incomingStream,
                  isSharingScreen: true,
                });
                return updated;
              }
              return prev;
            });

            const existingRef = memory.peersRef.current.get(targetUserId);
            if (existingRef && existingRef.screenStream?.id !== streamId) {
              memory.peersRef.current.set(targetUserId, { 
                ...existingRef, 
                screenStream: incomingStream, 
                isSharingScreen: true 
              });
            }

            event.track.onended = () => {
              memory.setPeers((prev) => {
                const updated = new Map<string, PeerData>(prev);
                const existing = updated.get(targetUserId);
                if (existing) {
                  updated.set(targetUserId, { ...existing, screenStream: null, isSharingScreen: false });
                }
                return updated;
              });
              const ref = memory.peersRef.current.get(targetUserId);
              if (ref) {
                memory.peersRef.current.set(targetUserId, { ...ref, screenStream: null, isSharingScreen: false });
              }
              videoStreamIds.delete(streamId);
            };
          } else {
            // This is a camera video stream
            memory.setPeers((prev) => {
              const existing = prev.get(targetUserId);
              const updated = new Map<string, PeerData>(prev);
              updated.set(targetUserId, {
                ...(existing || {
                  userId: targetUserId,
                  userName: targetUserName,
                  stream: null,
                  screenStream: null,
                  connection: pc,
                  isMuted: false,
                  isSharingScreen: false,
                  connectionState: pc.iceConnectionState,
                  audioLevel: 0,
                  isSpeaking: false,
                }) as PeerData,
                videoStream: incomingStream,
                isVideoEnabled: true,
              });
              return updated;
            });

            const existingRef = memory.peersRef.current.get(targetUserId);
            memory.peersRef.current.set(targetUserId, {
              ...(existingRef || {
                userId: targetUserId,
                userName: targetUserName,
                stream: null,
                screenStream: null,
                connection: pc,
                isMuted: false,
                isSharingScreen: false,
                connectionState: pc.iceConnectionState,
                audioLevel: 0,
                isSpeaking: false,
              }) as PeerData,
              videoStream: incomingStream,
              isVideoEnabled: true,
            });

            event.track.onended = () => {
              memory.setPeers((prev) => {
                const updated = new Map<string, PeerData>(prev);
                const existing = updated.get(targetUserId);
                if (existing) {
                  updated.set(targetUserId, { ...existing, videoStream: null, isVideoEnabled: false });
                }
                return updated;
              });
              const ref = memory.peersRef.current.get(targetUserId);
              if (ref) {
                memory.peersRef.current.set(targetUserId, { ...ref, videoStream: null, isVideoEnabled: false });
              }
              videoStreamIds.delete(streamId);
            };
          }
        }
      };

      pc.onnegotiationneeded = async () => {
        const polite = memory.politeRef.current.get(targetUserId);
        const alreadyNegotiated = memory.negotiationDoneRef.current.get(targetUserId);

        if (polite && !alreadyNegotiated) {
          console.log(`[WebRTC] Skipping initial onnegotiationneeded for polite peer ${targetUserName}`);
          return;
        }

        try {
          memory.makingOfferRef.current.set(targetUserId, true);
          
          const offer = await pc.createOffer();
          offer.sdp = setOpusLowLatency(offer.sdp || "");
          await pc.setLocalDescription(offer);

          memory.socketRef.current?.emit("signal", {
            to: targetUserId,
            from: userId,
            fromName: userName,
            signal: pc.localDescription,
            type: "offer",
          });
        } catch (err) {
          console.error("[WebRTC] Error during negotiation:", err);
        } finally {
          memory.makingOfferRef.current.set(targetUserId, false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log(`[ICE] ${targetUserName}: ${state}`);

        if (state === "connected" || state === "completed") {
          memory.negotiationDoneRef.current.set(targetUserId, true);
        }

        memory.setPeers((prev) => {
          const updated = new Map<string, PeerData>(prev);
          const existing = updated.get(targetUserId);
          if (existing) {
            updated.set(targetUserId, { ...(existing as PeerData), connectionState: state });
          }
          return updated;
        });

        if (state === "failed") {
          pc.restartIce();
        }

        if (state === "disconnected" || state === "closed") {
          setTimeout(() => {
            if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "closed") {
              cleanupPeer(targetUserId);
            }
          }, 5000);
        }
      };

      const peerData: PeerData = {
        userId: targetUserId,
        userName: targetUserName,
        stream: null,
        screenStream: null,
        videoStream: null,
        connection: pc,
        isMuted: false,
        isSharingScreen: false,
        isVideoEnabled: false,
        connectionState: pc.iceConnectionState,
        audioLevel: 0,
        isSpeaking: false,
      };

      memory.setPeers((prev) => {
        const updated = new Map(prev);
        updated.set(targetUserId, peerData);
        return updated;
      });
      memory.peersRef.current.set(targetUserId, peerData);

      return pc;
    },
    [userId, userName, setupAudioAnalyser, cleanupPeer, memoryRef]
  );

  // Audio level polling + active speaker detection
  useEffect(() => {
    const interval = setInterval(() => {
      const memory = memoryRef.current;
      const updates = new Map<string, { level: number; speaking: boolean }>();
      let maxLevel = 0;
      let maxPeerId: string | null = null;

      memory.analyserNodesRef.current.forEach((analyser, peerId) => {
        if (peerId === "local") return; // Skip local for active speaker
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const level = Math.min(avg / 128, 1);
        const speaking = level > SPEAKING_THRESHOLD;
        updates.set(peerId, { level, speaking });

        if (level > maxLevel && speaking) {
          maxLevel = level;
          maxPeerId = peerId;
        }
      });

      if (updates.size > 0) {
        memory.setPeers((prev) => {
          let updated: Map<string, PeerData> | null = null;
          updates.forEach(({ level, speaking }, peerId) => {
            const existing = prev.get(peerId);
            if (existing && (Math.abs(existing.audioLevel - level) > 0.05 || existing.isSpeaking !== speaking)) {
              if (!updated) updated = new Map<string, PeerData>(prev);
              updated.set(peerId, { ...existing, audioLevel: level, isSpeaking: speaking });
            }
          });
          return updated || prev;
        });
      }

      // Active speaker detection with debounce
      if (maxPeerId && maxPeerId !== memory.activeSpeakerId) {
        if (activeSpeakerTimeoutRef.current) {
          clearTimeout(activeSpeakerTimeoutRef.current);
        }
        activeSpeakerTimeoutRef.current = setTimeout(() => {
          memoryRef.current.setActiveSpeakerId(maxPeerId);
        }, ACTIVE_SPEAKER_DEBOUNCE_MS);
      } else if (!maxPeerId && memory.activeSpeakerId) {
        // Nobody speaking, clear after a longer delay
        if (activeSpeakerTimeoutRef.current) {
          clearTimeout(activeSpeakerTimeoutRef.current);
        }
        activeSpeakerTimeoutRef.current = setTimeout(() => {
          memoryRef.current.setActiveSpeakerId(null);
        }, 1500);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (activeSpeakerTimeoutRef.current) {
        clearTimeout(activeSpeakerTimeoutRef.current);
      }
    };
  }, [memoryRef]);

  return {
    createPeerConnection,
    cleanupPeer,
    flushIceCandidates,
    setupAudioAnalyser
  };
}
