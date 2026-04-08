import { useCallback, useEffect } from "react";
import { useStableMemory } from "../memory/useWebRTCMemory";
import { setOpusLowLatency, createLowLatencyAudioContext } from "../tools/sdpTools";
import { PeerData } from "../types";

interface UsePeerAgentOptions {
  userId: string;
  userName: string;
}

export function usePeerAgent({ userId, userName }: UsePeerAgentOptions) {
  const memoryRef = useStableMemory();

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
      // The user who receives the target connection is POLITE (polite = true).
      memory.politeRef.current.set(targetUserId, !isInitiator);

      // Add local audio tracks
      if (memory.localStreamRef.current) {
        memory.localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, memory.localStreamRef.current!);
        });
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

      pc.ontrack = (event) => {
        console.log(`[WebRTC] ontrack from ${targetUserName}, kind=${event.track.kind}`);
        // Ensure stream is properly captured, fallback to a new MediaStream if event.streams is empty
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
              connection: pc,
              isMuted: existing?.isMuted ?? false,
              isSharingScreen: existing?.isSharingScreen ?? false,
              connectionState: pc.iceConnectionState,
              audioLevel: 0,
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
            connection: pc,
            isMuted: existingRef?.isMuted ?? false,
            isSharingScreen: existingRef?.isSharingScreen ?? false,
            connectionState: pc.iceConnectionState,
            audioLevel: existingRef?.audioLevel ?? 0,
          });
        } else if (event.track.kind === "video") {
          memory.setPeers((prev) => {
            const existing = prev.get(targetUserId);
            if (existing && existing.screenStream?.id !== incomingStream.id) {
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
          if (existingRef && existingRef.screenStream?.id !== incomingStream.id) {
            memory.peersRef.current.set(targetUserId, { ...existingRef, screenStream: incomingStream, isSharingScreen: true });
          }

          event.track.onended = () => {
            memory.setPeers((prev) => {
              const updated = new Map<string, PeerData>(prev);
              const existing = updated.get(targetUserId);
              if (existing) {
                updated.set(targetUserId, { ...(existing as PeerData), screenStream: null, isSharingScreen: false });
              }
              return updated;
            });
            const ref = memory.peersRef.current.get(targetUserId);
            if (ref) {
              memory.peersRef.current.set(targetUserId, { ...ref, screenStream: null, isSharingScreen: false });
            }
          };
        }
      };

      pc.onnegotiationneeded = async () => {
        const polite = memory.politeRef.current.get(targetUserId);
        const alreadyNegotiated = memory.negotiationDoneRef.current.get(targetUserId);

        // Allow initial negotiation to skip creating offers if we are the polite peer waiting.
        // But once connected (alreadyNegotiated), ANY peer can create an offer based on Perfect Negotiation.
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
        connection: pc,
        isMuted: false,
        isSharingScreen: false,
        connectionState: pc.iceConnectionState,
        audioLevel: 0,
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

  // Audio level polling
  useEffect(() => {
    const interval = setInterval(() => {
      const memory = memoryRef.current;
      const updates = new Map<string, number>();

      memory.analyserNodesRef.current.forEach((analyser, peerId) => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const level = Math.min(avg / 128, 1);
        updates.set(peerId, level);
      });

      if (updates.size > 0) {
        memory.setPeers((prev) => {
          let updated: Map<string, PeerData> | null = null;
          updates.forEach((level, peerId) => {
            const existing = prev.get(peerId);
            if (existing && Math.abs(existing.audioLevel - level) > 0.05) {
              if (!updated) updated = new Map<string, PeerData>(prev);
              updated.set(peerId, { ...existing, audioLevel: level });
            }
          });
          return updated || prev;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [memoryRef]);

  return {
    createPeerConnection,
    cleanupPeer,
    flushIceCandidates,
    setupAudioAnalyser
  };
}
