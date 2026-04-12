import { useCallback, useEffect, useRef } from "react";
import { useStableMemory } from "../memory/useWebRTCMemory";
import {
  setOpusLowLatency,
  createLowLatencyAudioContext,
} from "../tools/sdpTools";
import { computePresentation, EMPTY_PRESENTATION } from "../tools/presentationTools";
import { PeerData } from "../types";

/**
 * Deterministic stream classification strategy
 * ─────────────────────────────────────────────
 * When useMediaAgent adds a track to a peer connection it emits
 * user-media-state with cameraStreamId or screenStreamId — the actual
 * MediaStream.id of the stream used for addTrack().
 *
 * useSignalingAgent stores those IDs in memory.peerStreamIdsRef.
 *
 * When ontrack fires here, we look up the incoming stream.id in
 * peerStreamIdsRef to get a deterministic "camera" | "screen" label.
 *
 * Race condition (ontrack fires before user-media-state arrives):
 *   → We park the stream in pendingVideoStreamsRef keyed by peerId+streamId.
 *   → useSignalingAgent drains the pending map when its IDs arrive.
 *
 * This eliminates:
 *   • rawVideoStreams[] — no arrays of streams
 *   • Track ordering assumptions — first/second video is meaningless here
 *   • Heuristic presentation guessing — every assignment is labeled
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
      if (
        !memory.audioContextRef.current ||
        memory.audioContextRef.current.state === "closed"
      ) {
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
    [memoryRef],
  );

  const cleanupPeer = useCallback(
    (peerId: string) => {
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
        memory.senderMapRef.current.delete(peerId);
        memory.peerStreamIdsRef.current.delete(peerId);
        memory.pendingVideoStreamsRef.current.delete(peerId);
        memory.setPeers((prev) => {
          const updated = new Map(prev);
          updated.delete(peerId);
          return updated;
        });
      }
    },
    [memoryRef],
  );

  const flushIceCandidates = useCallback(
    async (peerId: string, pc: RTCPeerConnection) => {
      const memory = memoryRef.current;
      const buffered = memory.iceCandidateBufferRef.current.get(peerId);
      if (buffered && buffered.length > 0) {
        console.log(
          `[ICE] Flushing ${buffered.length} buffered candidates for ${peerId}`,
        );
        for (const candidate of buffered) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn("[ICE] Error adding buffered candidate:", err);
          }
        }
        memory.iceCandidateBufferRef.current.set(peerId, []);
      }
    },
    [memoryRef],
  );

  /**
   * Applies a classified video stream to a peer's state.
   * Mutates BOTH the React state (setPeers) AND the stable ref (peersRef).
   */
  const applyVideoStream = useCallback(
    (
      peerId: string,
      stream: MediaStream | null,
      source: "camera" | "screen",
    ) => {
      const memory = memoryRef.current;

      const applyToPeerData = (existing: PeerData): PeerData => {
        const updated: PeerData = {
          ...existing,
          cameraStream: source === "camera" ? stream : existing.cameraStream,
          screenStream: source === "screen" ? stream : existing.screenStream,
        };
        updated.presentation = computePresentation(
          updated.cameraStream,
          updated.screenStream,
          updated.isSharingScreen,
        );
        return updated;
      };

      memory.setPeers((prev) => {
        const existing = prev.get(peerId);
        if (!existing) return prev;
        const next = new Map<string, PeerData>(prev);
        next.set(peerId, applyToPeerData(existing));
        return next;
      });

      const ref = memory.peersRef.current.get(peerId);
      if (ref) {
        memory.peersRef.current.set(peerId, applyToPeerData(ref));
      }
    },
    [memoryRef],
  );

  const createPeerConnection = useCallback(
    (
      targetUserId: string,
      targetUserName: string,
      isInitiator: boolean,
    ): RTCPeerConnection => {
      const memory = memoryRef.current;
      const pc = new RTCPeerConnection({
        iceServers: memory.iceServersRef.current,
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });

      // Initialize negotiation state for this peer
      memory.iceCandidateBufferRef.current.set(targetUserId, []);
      memory.makingOfferRef.current.set(targetUserId, false);
      memory.ignoreOfferRef.current.set(targetUserId, false);
      memory.negotiationDoneRef.current.set(targetUserId, false);

      // Perfect negotiation: the initiator is IMPOLITE (will not rollback on collision)
      memory.politeRef.current.set(targetUserId, !isInitiator);

      // ── Add local tracks ──────────────────────────────────────────────────

      // Audio
      if (memory.localStreamRef.current) {
        memory.localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, memory.localStreamRef.current!);
        });
      }

      // Camera video (if already enabled)
      if (memory.videoStreamRef.current) {
        const videoTrack = memory.videoStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          const sender = pc.addTrack(videoTrack, memory.videoStreamRef.current);
          const senders = memory.senderMapRef.current.get(targetUserId) || {};
          senders.cameraSender = sender;
          memory.senderMapRef.current.set(targetUserId, senders);
        }
      }

      // Screen share (if already sharing)
      if (memory.screenStreamRef.current) {
        const videoTrack = memory.screenStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          const sender = pc.addTrack(
            videoTrack,
            memory.screenStreamRef.current,
          );
          const senders = memory.senderMapRef.current.get(targetUserId) || {};
          senders.screenSender = sender;
          memory.senderMapRef.current.set(targetUserId, senders);
        }
      }

      // ── ICE ──────────────────────────────────────────────────────────────
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

      // ── Track reception ──────────────────────────────────────────────────
      pc.ontrack = (event) => {
        console.log(
          `[WebRTC] ontrack from ${targetUserName}, kind=${event.track.kind}, streams=${event.streams.length}`,
        );
        const incomingStream =
          event.streams && event.streams[0]
            ? event.streams[0]
            : new MediaStream([event.track]);

        if (event.track.kind === "audio") {
          // ── Audio track ─────────────────────────────────────────────────
          setupAudioAnalyser(incomingStream, targetUserId);

          const buildAudioPeer = (existing: PeerData | undefined): PeerData => ({
            userId: targetUserId,
            userName: targetUserName,
            stream: incomingStream,
            cameraStream: existing?.cameraStream ?? null,
            screenStream: existing?.screenStream ?? null,
            presentation: existing?.presentation ?? EMPTY_PRESENTATION,
            connection: pc,
            isMuted: existing?.isMuted ?? false,
            isSharingScreen: existing?.isSharingScreen ?? false,
            isVideoEnabled: existing?.isVideoEnabled ?? false,
            connectionState: pc.iceConnectionState,
            audioLevel: existing?.audioLevel ?? 0,
            isSpeaking: existing?.isSpeaking ?? false,
          });

          memory.setPeers((prev) => {
            const next = new Map<string, PeerData>(prev);
            next.set(targetUserId, buildAudioPeer(prev.get(targetUserId)));
            return next;
          });
          memory.peersRef.current.set(
            targetUserId,
            buildAudioPeer(memory.peersRef.current.get(targetUserId)),
          );
        } else if (event.track.kind === "video") {
          // ── Video track — deterministic classification via stream IDs ───
          const incomingStreamId = incomingStream.id;
          const streamIds = memory.peerStreamIdsRef.current.get(targetUserId);

          let source: "camera" | "screen" | null = null;

          if (streamIds?.cameraStreamId === incomingStreamId) {
            source = "camera";
          } else if (streamIds?.screenStreamId === incomingStreamId) {
            source = "screen";
          } else {
            // user-media-state has not arrived yet.
            // Park the stream; useSignalingAgent will drain it when IDs arrive.
            const peerPending =
              memory.pendingVideoStreamsRef.current.get(targetUserId) ??
              new Map<string, MediaStream>();
            peerPending.set(incomingStreamId, incomingStream);
            memory.pendingVideoStreamsRef.current.set(
              targetUserId,
              peerPending,
            );
            console.log(
              `[WebRTC] Video track from ${targetUserName} parked pending ID (streamId=${incomingStreamId})`,
            );
          }

          if (source) {
            applyVideoStream(targetUserId, incomingStream, source);
          }

          // Deterministic cleanup: when the track ends, we know the source label
          event.track.onended = () => {
            // Re-read source from peerStreamIdsRef at the time of cleanup
            const ids =
              memory.peerStreamIdsRef.current.get(targetUserId);
            const finalSource: "camera" | "screen" =
              ids?.cameraStreamId === incomingStreamId ? "camera" :
              ids?.screenStreamId === incomingStreamId ? "screen" :
              source ?? "camera"; // fallback to the source we found at ontrack time

            applyVideoStream(targetUserId, null, finalSource);
            console.log(
              `[WebRTC] Track ended for ${targetUserName} (source=${finalSource})`,
            );
          };
        }
      };

      // ── Negotiation ──────────────────────────────────────────────────────
      pc.onnegotiationneeded = async () => {
        const polite = memory.politeRef.current.get(targetUserId);
        const alreadyNegotiated =
          memory.negotiationDoneRef.current.get(targetUserId);

        if (polite && !alreadyNegotiated) {
          console.log(
            `[WebRTC] Skipping initial onnegotiationneeded for polite peer ${targetUserName}`,
          );
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

      // ── ICE connection state ──────────────────────────────────────────────
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
            updated.set(targetUserId, {
              ...(existing as PeerData),
              connectionState: state,
            });
          }
          return updated;
        });

        if (state === "failed") {
          console.warn(`[ICE] ${targetUserName}: failed — restarting ICE`);
          pc.restartIce();
        }

        if (state === "disconnected" || state === "closed") {
          setTimeout(() => {
            if (
              pc.iceConnectionState === "disconnected" ||
              pc.iceConnectionState === "closed"
            ) {
              cleanupPeer(targetUserId);
            }
          }, 5000);
        }
      };

      // ── DTLS/transport connection state (Phase 4 resilience) ──────────────
      // This catches transport-level failures that ICE state sometimes misses.
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log(`[DTLS] ${targetUserName}: ${state}`);

        if (state === "failed") {
          // Hard failure: attempt ICE restart; if still failed after 8s, tear down
          console.warn(`[DTLS] ${targetUserName}: connection failed — restarting ICE`);
          pc.restartIce();
          setTimeout(() => {
            if (pc.connectionState === "failed") {
              console.error(`[DTLS] ${targetUserName}: unrecoverable — cleaning up`);
              cleanupPeer(targetUserId);
            }
          }, 8000);
        }

        if (state === "disconnected") {
          // Give 15s for transport to self-recover before forcing teardown
          setTimeout(() => {
            if (
              pc.connectionState === "disconnected" ||
              pc.connectionState === "failed" ||
              pc.connectionState === "closed"
            ) {
              console.warn(`[DTLS] ${targetUserName}: recovery timeout — cleaning up`);
              cleanupPeer(targetUserId);
            }
          }, 15000);
        }
      };


      // ── Initial PeerData entry ────────────────────────────────────────────
      const peerData: PeerData = {
        userId: targetUserId,
        userName: targetUserName,
        stream: null,
        cameraStream: null,
        screenStream: null,
        presentation: EMPTY_PRESENTATION,
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
    [userId, userName, setupAudioAnalyser, cleanupPeer, applyVideoStream, memoryRef],
  );

  // ── Audio level polling + active speaker detection ──────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const memory = memoryRef.current;
      const updates = new Map<string, { level: number; speaking: boolean }>();
      let maxLevel = 0;
      let maxPeerId: string | null = null;

      memory.analyserNodesRef.current.forEach((analyser, peerId) => {
        if (peerId === "local") return;
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
            if (
              existing &&
              (Math.abs(existing.audioLevel - level) > 0.05 ||
                existing.isSpeaking !== speaking)
            ) {
              if (!updated) updated = new Map<string, PeerData>(prev);
              updated.set(peerId, {
                ...existing,
                audioLevel: level,
                isSpeaking: speaking,
              });
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
    setupAudioAnalyser,
  };
}
