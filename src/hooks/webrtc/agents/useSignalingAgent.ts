import { useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { useStableMemory } from "../memory/useWebRTCMemory";
import { fetchTurnCredentials } from "../tools/networkTools";
import {
  setOpusLowLatency,
  BLUETOOTH_AUDIO_CONSTRAINTS,
} from "../tools/sdpTools";
import { ChatMessage, PeerData } from "../types";
import { computePresentation } from "../tools/presentationTools";

export interface UseSignalingAgentOptions {
  roomId: string;
  userId: string;
  userName: string;
  serverUrl: string;
  /** Preferred microphone device ID from pre-join screen */
  preferredAudioInputId?: string;
  /** Start with microphone muted */
  startMuted?: boolean;
  createPeerConnection: (
    targetUserId: string,
    targetUserName: string,
    isInitiator: boolean,
  ) => RTCPeerConnection;
  cleanupPeer: (peerId: string) => void;
  flushIceCandidates: (peerId: string, pc: RTCPeerConnection) => Promise<void>;
  setupAudioAnalyser: (stream: MediaStream, peerId: string) => void;
  /**
   * Called when getUserMedia fails so the UI can show a PermissionOverlay.
   * "microphone-denied" | "camera-denied" | "both-denied" |
   * "microphone-not-found" | "overconstrained" | null
   */
  onPermissionError?: (err: string) => void;
}

export function useSignalingAgent({
  roomId,
  userId,
  userName,
  serverUrl,
  preferredAudioInputId,
  startMuted = false,
  createPeerConnection,
  cleanupPeer,
  flushIceCandidates,
  setupAudioAnalyser,
  onPermissionError,
}: UseSignalingAgentOptions) {
  const memoryRef = useStableMemory();

  // Stable refs for callbacks so the effect doesn't need to depend on them
  const createPeerRef = useRef(createPeerConnection);
  createPeerRef.current = createPeerConnection;
  const cleanupPeerRef = useRef(cleanupPeer);
  cleanupPeerRef.current = cleanupPeer;
  const flushIceRef = useRef(flushIceCandidates);
  flushIceRef.current = flushIceCandidates;
  const setupAnalyserRef = useRef(setupAudioAnalyser);
  setupAnalyserRef.current = setupAudioAnalyser;

  const updatePeerState = useCallback(
    (peerId: string, updater: (peer: PeerData) => PeerData) => {
      const memory = memoryRef.current;
      const refPeer = memory.peersRef.current.get(peerId);
      const refNextPeer = refPeer ? updater(refPeer) : null;

      if (refNextPeer) {
        memory.peersRef.current.set(peerId, refNextPeer);
      }

      memory.setPeers((prev) => {
        const existing = prev.get(peerId);
        if (!existing) return prev;
        const nextPeer = refNextPeer ?? updater(existing);
        const updated = new Map<string, PeerData>(prev);
        updated.set(peerId, nextPeer);
        if (!refNextPeer) {
          memory.peersRef.current.set(peerId, nextPeer);
        }
        return updated;
      });
    },
    [memoryRef],
  );

  const stopLocalCameraForHostControl = useCallback(() => {
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
      if (!senders?.cameraSender) return;
      try {
        if (peer.connection.signalingState !== "closed") {
          peer.connection.removeTrack(senders.cameraSender);
        }
      } catch (err) {
        console.warn("[HostControl] Failed to remove camera sender:", err);
      }
      delete senders.cameraSender;
      memory.senderMapRef.current.set(peerId, senders);
    });

    memory.setIsVideoEnabled(false);
  }, [memoryRef]);

  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    async function connect() {
      const memory = memoryRef.current;

      memory.iceServersRef.current = await fetchTurnCredentials(serverUrl);

      try {
        const audioConstraints: MediaTrackConstraints = {
          ...BLUETOOTH_AUDIO_CONSTRAINTS,
          ...(preferredAudioInputId
            ? { deviceId: { exact: preferredAudioInputId } }
            : {}),
        };
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Apply start-muted preference immediately
        if (startMuted) {
          stream.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
          memory.setIsMuted(true);
        }

        memory.localStreamRef.current = stream;
        memory.setLocalStream(stream);
        setupAnalyserRef.current(stream, "local");
      } catch (err) {
        console.error("[Media] Microphone access denied:", err);
        if (err instanceof DOMException) {
          const n = err.name;
          if (n === "NotAllowedError" || n === "PermissionDeniedError") {
            onPermissionError?.("microphone-denied");
          } else if (n === "NotFoundError" || n === "DevicesNotFoundError") {
            onPermissionError?.("microphone-not-found");
          } else if (
            n === "OverconstrainedError" ||
            n === "ConstraintNotSatisfiedError"
          ) {
            onPermissionError?.("overconstrained");
          }
        }
        return;
      }

      const socket = io(serverUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      memory.socketRef.current = socket;
      // Expose for manual retry from ReconnectionOverlay
      (window as any).__audioHubSocket = socket;

      socket.on("connect", () => {
        if (!mounted) return;
        memory.setIsConnected(true);
        socket.emit("join-room", roomId, userId, userName);
        memory.addActivity({
          type: "join",
          userName: "You",
          timestamp: Date.now(),
        });
      });

      socket.on("disconnect", () => {
        if (!mounted) return;
        memory.setIsConnected(false);
      });

      socket.on("room-users", (users: any[]) => {
        if (!mounted) return;
        users.forEach((user) => {
          createPeerRef.current(user.userId, user.userName, false);
          memory.addActivity({
            type: "join",
            userName: user.userName,
            timestamp: Date.now(),
          });

          // Also set extended fields
          setTimeout(() => {
            memory.setPeers((prev) => {
              const p = prev.get(user.userId);
              if (p) {
                const newP = new Map(prev);
                newP.set(user.userId, {
                  ...p,
                  role: user.role,
                  isMutedByHost: user.isMutedByHost,
                  isVideoDisabledByHost: user.isVideoDisabledByHost,
                });
                return newP;
              }
              return prev;
            });
          }, 50);
        });
      });

      socket.on(
        "room-joined-success",
        (data: {
          role: "host" | "participant" | "unknown";
          isMutedByHost: boolean;
          isVideoDisabledByHost: boolean;
        }) => {
          if (!mounted) return;
          memory.setUserRole(data.role);
          memory.setIsMutedByHost(data.isMutedByHost);
          memory.setIsVideoDisabledByHost(data.isVideoDisabledByHost);
        },
      );

      socket.on(
        "user-connected",
        (newUserId: string, newUserName: string, role?: string) => {
          if (!mounted) return;
          console.log(`[Room] ${newUserName} connected (Role: ${role})`);
          createPeerRef.current(newUserId, newUserName, true);
          memory.addActivity({
            type: "join",
            userName: newUserName,
            timestamp: Date.now(),
          });

          if (role) {
            setTimeout(() => {
              memory.setPeers((prev) => {
                const p = prev.get(newUserId);
                if (p) {
                  const newP = new Map(prev);
                  newP.set(newUserId, {
                    ...p,
                    role: role as any,
                    isMutedByHost: false,
                    isVideoDisabledByHost: false,
                  });
                  return newP;
                }
                return prev;
              });
            }, 50);
          }
        },
      );

      socket.on("signal", async ({ from, fromName, signal, type }: any) => {
        if (!mounted) return;
        const mem = memoryRef.current;

        let peer = mem.peersRef.current.get(from);
        let pc = peer?.connection;

        if (!pc) {
          pc = createPeerRef.current(from, fromName, false);
        }

        try {
          if (type === "offer") {
            const polite = mem.politeRef.current.get(from) ?? false;
            const makingOffer = mem.makingOfferRef.current.get(from) ?? false;
            const offerCollision =
              makingOffer || pc.signalingState !== "stable";

            mem.ignoreOfferRef.current.set(from, !polite && offerCollision);
            if (mem.ignoreOfferRef.current.get(from)) {
              console.log(
                `[WebRTC] Ignoring offer collision from ${fromName} (we are impolite)`,
              );
              return;
            }

            if (offerCollision) {
              console.log(
                `[WebRTC] Offer collision with ${fromName}, rolling back (we are polite)`,
              );
              await pc.setLocalDescription({ type: "rollback" });
            }

            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            await flushIceRef.current(from, pc);

            const answer = await pc.createAnswer();
            answer.sdp = setOpusLowLatency(answer.sdp || "");
            await pc.setLocalDescription(answer);

            socket.emit("signal", {
              to: from,
              from: userId,
              fromName: userName,
              signal: pc.localDescription,
              type: "answer",
            });
            mem.negotiationDoneRef.current.set(from, true);
          } else if (type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            await flushIceRef.current(from, pc);
            mem.negotiationDoneRef.current.set(from, true);
          } else if (type === "candidate") {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal));
              } catch (err) {
                if (!mem.ignoreOfferRef.current.get(from)) {
                  console.error(
                    `[ICE] Error adding candidate from ${fromName}`,
                    err,
                  );
                }
              }
            } else {
              if (!mem.ignoreOfferRef.current.get(from)) {
                console.log(`[ICE] Buffering candidate from ${fromName}`);
                const buffer =
                  mem.iceCandidateBufferRef.current.get(from) || [];
                buffer.push(signal);
                mem.iceCandidateBufferRef.current.set(from, buffer);
              }
            }
          }
        } catch (err) {
          console.error(`[Signal] Error handling ${type}:`, err);
        }
      });

      socket.on("user-disconnected", (disconnectedUserId: string) => {
        if (!mounted) return;
        const mem = memoryRef.current;
        const peer = mem.peersRef.current.get(disconnectedUserId);
        if (peer) {
          mem.addActivity({
            type: "leave",
            userName: peer.userName,
            timestamp: Date.now(),
          });
        }
        cleanupPeerRef.current(disconnectedUserId);
      });

      socket.on(
        "user-media-state",
        ({
          userId: changedUserId,
          isMuted: muted,
          isSharingScreen: sharing,
          isVideoEnabled: video,
          cameraStreamId,
          screenStreamId,
        }: {
          userId: string;
          isMuted?: boolean;
          isSharingScreen?: boolean;
          isVideoEnabled?: boolean;
          cameraStreamId?: string;
          screenStreamId?: string;
        }) => {
          if (!mounted) return;
          const mem = memoryRef.current;

          // 1. Persist stream IDs so ontrack can classify without guessing.
          if (cameraStreamId || screenStreamId) {
            const prev = mem.peerStreamIdsRef.current.get(changedUserId) ?? {};
            mem.peerStreamIdsRef.current.set(changedUserId, {
              ...prev,
              ...(cameraStreamId ? { cameraStreamId } : {}),
              ...(screenStreamId ? { screenStreamId } : {}),
            });

            // 2. Drain pending video streams that arrived before their IDs.
            const pending = mem.pendingVideoStreamsRef.current.get(changedUserId);
            if (pending) {
              if (cameraStreamId && pending.has(cameraStreamId)) {
                const stream = pending.get(cameraStreamId)!;
                pending.delete(cameraStreamId);
                // Apply retroactively: update both React state and stable ref
                const applyCamera = (existing: PeerData): PeerData => {
                  const updated = { ...existing, cameraStream: stream };
                  updated.presentation = computePresentation(
                    updated.cameraStream, updated.screenStream, updated.isSharingScreen,
                  );
                  return updated;
                };
                updatePeerState(changedUserId, applyCamera);
              }
              if (screenStreamId && pending.has(screenStreamId)) {
                const stream = pending.get(screenStreamId)!;
                pending.delete(screenStreamId);
                const applyScreen = (existing: PeerData): PeerData => {
                  const updated = { ...existing, screenStream: stream };
                  updated.presentation = computePresentation(
                    updated.cameraStream, updated.screenStream, updated.isSharingScreen,
                  );
                  return updated;
                };
                updatePeerState(changedUserId, applyScreen);
              }
              if (pending.size === 0) {
                mem.pendingVideoStreamsRef.current.delete(changedUserId);
              }
            }
          }

          // 3. Update peer flags and recompute presentation deterministically.
          updatePeerState(changedUserId, (existing) => {
            const newData = { ...existing };

            if (muted !== undefined && muted !== existing.isMuted) {
              newData.isMuted = muted;
              mem.addActivity({
                type: muted ? "mute" : "unmute",
                userName: existing.userName,
                timestamp: Date.now(),
              });
            }
            if (sharing !== undefined && sharing !== existing.isSharingScreen) {
              newData.isSharingScreen = sharing;
              // If screen share stopped, clear the stream immediately (track.onended
              // also fires, but this ensures no stale stream on the flag alone).
              if (!sharing) newData.screenStream = null;
              mem.addActivity({
                type: sharing ? "screen-share" : "screen-stop",
                userName: existing.userName,
                timestamp: Date.now(),
              });
            }
            if (video !== undefined && video !== existing.isVideoEnabled) {
              newData.isVideoEnabled = video;
              if (!video) newData.cameraStream = null; // redundant safety
              mem.addActivity({
                type: video ? "video-on" : "video-off",
                userName: existing.userName,
                timestamp: Date.now(),
              });
            }

            // Always recompute; computePresentation is pure and cheap.
            newData.presentation = computePresentation(
              newData.cameraStream,
              newData.screenStream,
              newData.isSharingScreen,
            );

            return newData;
          });
        },
      );

      // --- Host Control Events ---
      socket.on(
        "user-media-control-updated",
        (data: {
          userId: string;
          isMutedByHost: boolean;
          isVideoDisabledByHost: boolean;
        }) => {
          if (!mounted) return;
          const mem = memoryRef.current;

          if (data.userId === userId) {
            // This is targeting the local user
            mem.setIsMutedByHost(data.isMutedByHost);
            mem.setIsVideoDisabledByHost(data.isVideoDisabledByHost);

            if (data.isMutedByHost) {
              mem.setIsMuted(true);
              mem.localStreamRef.current
                ?.getAudioTracks()
                .forEach((t) => (t.enabled = false));
              // Use consolidated event
              socket.emit("user-media-state", {
                isMuted: true,
                isVideoEnabled: mem.isVideoEnabled,
                isSharingScreen: mem.isSharingScreen,
              });
            }

            if (data.isVideoDisabledByHost) {
              stopLocalCameraForHostControl();
              socket.emit("user-media-state", {
                isMuted: mem.isMuted,
                isVideoEnabled: false,
                isSharingScreen: mem.isSharingScreen,
              });
            }
          } else {
            // Targeting remote peer, update PeerData
            updatePeerState(data.userId, (peer) => {
              const nextPeer = {
                ...peer,
                isMutedByHost: data.isMutedByHost,
                isVideoDisabledByHost: data.isVideoDisabledByHost,
                // also forcibly update their regular status locally so UI reflects it immediately
                isMuted: data.isMutedByHost ? true : peer.isMuted,
                isVideoEnabled: data.isVideoDisabledByHost
                  ? false
                  : peer.isVideoEnabled,
                cameraStream: data.isVideoDisabledByHost ? null : peer.cameraStream,
              };
              return {
                ...nextPeer,
                presentation: computePresentation(
                  nextPeer.cameraStream,
                  nextPeer.screenStream,
                  nextPeer.isSharingScreen,
                ),
              };
            });
          }
        },
      );

      socket.on("new-host-assigned", (newHostId: string) => {
        if (!mounted) return;
        const mem = memoryRef.current;

        if (newHostId === userId) {
          mem.setUserRole("host");
          console.log("[Host] You are now the host!");
        } else {
          mem.setPeers((prev) => {
            const updated = new Map<string, PeerData>(prev);
            const peer = updated.get(newHostId);
            if (peer) {
              updated.set(newHostId, { ...peer, role: "host" });
            }
            return updated;
          });
        }
      });

      socket.on("room-user-count", (count: number) => {
        if (!mounted) return;
        memoryRef.current.setRoomUserCount(count);
      });

      socket.on("chat-message", (msg: ChatMessage) => {
        if (!mounted) return;
        memoryRef.current.setChatMessages((prev) => [...prev, msg]);
        memoryRef.current.addActivity({
          type: "chat",
          userName: msg.userName,
          timestamp: msg.timestamp,
        });
      });
    }

    connect();

    return () => {
      mounted = false;
      const memory = memoryRef.current;

      memory.localStreamRef.current?.getTracks().forEach((t) => t.stop());
      memory.screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      memory.videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      memory.peersRef.current.forEach((peer) => peer.connection.close());
      memory.peersRef.current.clear();
      if (
        memory.audioContextRef.current &&
        memory.audioContextRef.current.state !== "closed"
      ) {
        memory.audioContextRef.current
          .close()
          .catch((err) => console.log("AudioContext close:", err));
      }
      memory.analyserNodesRef.current.clear();
      memory.iceCandidateBufferRef.current.clear();
      memory.makingOfferRef.current.clear();
      memory.negotiationDoneRef.current.clear();
      memory.politeRef.current.clear();
      memory.ignoreOfferRef.current.clear();
      memory.senderMapRef.current.clear();
      memory.peerStreamIdsRef.current.clear();
      memory.pendingVideoStreamsRef.current.clear();
      memory.socketRef.current?.disconnect();

      memory.setPeers(new Map());
      memory.setLocalStream(null);
      memory.setLocalScreenStream(null);
      memory.setLocalVideoStream(null);
      memory.setChatMessages([]);
      memory.setIsConnected(false);
      memory.setIsSharingScreen(false);
      memory.setIsMuted(false);
      memory.setIsVideoEnabled(false);
      memory.setActiveSpeakerId(null);
      memory.setUserRole("unknown");
      memory.setIsMutedByHost(false);
      memory.setIsVideoDisabledByHost(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, userName, serverUrl]);

  const sendChatMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return;
      const memory = memoryRef.current;
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        userId,
        userName,
        message: message.trim(),
        timestamp: Date.now(),
      };
      memory.setChatMessages((prev) => [...prev, { ...msg, isLocal: true }]);
      memory.socketRef.current?.emit("chat-message", msg);
    },
    [userId, userName, memoryRef],
  );

  const disconnect = useCallback(() => {
    memoryRef.current.socketRef.current?.disconnect();
  }, [memoryRef]);

  const triggerHostAction = useCallback(
    (
      targetUserId: string,
      action: "mute" | "unmute" | "disableVideo" | "enableVideo",
    ) => {
      const memory = memoryRef.current;
      if (memory.userRole !== "host") return;

      if (action === "mute" || action === "unmute") {
        memory.socketRef.current?.emit("host-mute-user", {
          targetUserId,
          action,
        });
      } else {
        memory.socketRef.current?.emit("host-disable-video", {
          targetUserId,
          action,
        });
      }
    },
    [memoryRef],
  );

  return {
    sendChatMessage,
    disconnect,
    triggerHostAction,
  };
}
