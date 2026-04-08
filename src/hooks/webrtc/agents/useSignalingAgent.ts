import { useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { useStableMemory } from "../memory/useWebRTCMemory";
import { fetchTurnCredentials } from "../tools/networkTools";
import { setOpusLowLatency, BLUETOOTH_AUDIO_CONSTRAINTS } from "../tools/sdpTools";
import { ChatMessage, PeerData } from "../types";

export interface UseSignalingAgentOptions {
  roomId: string;
  userId: string;
  userName: string;
  serverUrl: string;
  createPeerConnection: (targetUserId: string, targetUserName: string, isInitiator: boolean) => RTCPeerConnection;
  cleanupPeer: (peerId: string) => void;
  flushIceCandidates: (peerId: string, pc: RTCPeerConnection) => Promise<void>;
  setupAudioAnalyser: (stream: MediaStream, peerId: string) => void;
}

export function useSignalingAgent({
  roomId,
  userId,
  userName,
  serverUrl,
  createPeerConnection,
  cleanupPeer,
  flushIceCandidates,
  setupAudioAnalyser
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

  useEffect(() => {
    if (!roomId) return;
    
    let mounted = true;

    async function connect() {
      const memory = memoryRef.current;
      
      memory.iceServersRef.current = await fetchTurnCredentials(serverUrl);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: BLUETOOTH_AUDIO_CONSTRAINTS,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        memory.localStreamRef.current = stream;
        memory.setLocalStream(stream);
        setupAnalyserRef.current(stream, "local");
      } catch (err) {
        console.error("[Media] Microphone access denied:", err);
        return;
      }

      const socket = io(serverUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      memory.socketRef.current = socket;

      socket.on("connect", () => {
        if (!mounted) return;
        memory.setIsConnected(true);
        socket.emit("join-room", roomId, userId, userName);
        memory.addActivity({ type: "join", userName: "You", timestamp: Date.now() });
      });

      socket.on("disconnect", () => {
        if (!mounted) return;
        memory.setIsConnected(false);
      });

      socket.on("room-users", (users: any[]) => {
        if (!mounted) return;
        users.forEach((user) => {
          createPeerRef.current(user.userId, user.userName, false);
          memory.addActivity({ type: "join", userName: user.userName, timestamp: Date.now() });

          // Also set extended fields
          setTimeout(() => {
            memory.setPeers(prev => {
              const p = prev.get(user.userId);
              if (p) {
                const newP = new Map(prev);
                newP.set(user.userId, { ...p, role: user.role, isMutedByHost: user.isMutedByHost, isVideoDisabledByHost: user.isVideoDisabledByHost });
                return newP;
              }
              return prev;
            });
          }, 50);
        });
      });

      socket.on("room-joined-success", (data: { role: "host" | "participant" | "unknown", isMutedByHost: boolean, isVideoDisabledByHost: boolean }) => {
        if (!mounted) return;
        memory.setUserRole(data.role);
        memory.setIsMutedByHost(data.isMutedByHost);
        memory.setIsVideoDisabledByHost(data.isVideoDisabledByHost);
      });

      socket.on("user-connected", (newUserId: string, newUserName: string, role?: string) => {
        if (!mounted) return;
        console.log(`[Room] ${newUserName} connected (Role: ${role})`);
        createPeerRef.current(newUserId, newUserName, true);
        memory.addActivity({ type: "join", userName: newUserName, timestamp: Date.now() });

        if (role) {
          setTimeout(() => {
            memory.setPeers(prev => {
              const p = prev.get(newUserId);
              if (p) {
                const newP = new Map(prev);
                newP.set(newUserId, { ...p, role: role as any, isMutedByHost: false, isVideoDisabledByHost: false });
                return newP;
              }
              return prev;
            });
          }, 50);
        }
      });

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
            const offerCollision = makingOffer || pc.signalingState !== "stable";

            mem.ignoreOfferRef.current.set(from, !polite && offerCollision);
            if (mem.ignoreOfferRef.current.get(from)) {
              console.log(`[WebRTC] Ignoring offer collision from ${fromName} (we are impolite)`);
              return;
            }

            if (offerCollision) {
              console.log(`[WebRTC] Offer collision with ${fromName}, rolling back (we are polite)`);
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
                  console.error(`[ICE] Error adding candidate from ${fromName}`, err);
                }
              }
            } else {
              if (!mem.ignoreOfferRef.current.get(from)) {
                console.log(`[ICE] Buffering candidate from ${fromName}`);
                const buffer = mem.iceCandidateBufferRef.current.get(from) || [];
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
          mem.addActivity({ type: "leave", userName: peer.userName, timestamp: Date.now() });
        }
        cleanupPeerRef.current(disconnectedUserId);
      });

      socket.on("user-status-changed", ({ userId: changedUserId, isMuted: muted, isSharingScreen: sharing, isVideoEnabled: video }: any) => {
        if (!mounted) return;
        const mem = memoryRef.current;
        mem.setPeers((prev) => {
          const updated = new Map<string, PeerData>(prev);
          const existing = updated.get(changedUserId);
          if (existing) {
            const newData = { ...(existing as PeerData) };
            if (muted !== undefined) {
              newData.isMuted = muted;
              mem.addActivity({ type: muted ? "mute" : "unmute", userName: (existing as PeerData).userName, timestamp: Date.now() });
            }
            if (sharing !== undefined) {
              newData.isSharingScreen = sharing;
              mem.addActivity({ type: sharing ? "screen-share" : "screen-stop", userName: (existing as PeerData).userName, timestamp: Date.now() });
            }
            if (video !== undefined) {
              newData.isVideoEnabled = video;
              if (video) {
                mem.addActivity({ type: "video-on", userName: (existing as PeerData).userName, timestamp: Date.now() });
              } else {
                mem.addActivity({ type: "video-off", userName: (existing as PeerData).userName, timestamp: Date.now() });
              }
            }
            updated.set(changedUserId, newData);
          }
          return updated;
        });
      });

      // --- Host Control Events ---
      socket.on("user-media-control-updated", (data: { userId: string, isMutedByHost: boolean, isVideoDisabledByHost: boolean }) => {
        if (!mounted) return;
        const mem = memoryRef.current;
        
        if (data.userId === userId) {
          // This is targeting the local user
          mem.setIsMutedByHost(data.isMutedByHost);
          mem.setIsVideoDisabledByHost(data.isVideoDisabledByHost);

          if (data.isMutedByHost) {
            mem.setIsMuted(true);
            mem.localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = false);
            socket.emit("user-muted", true);
          }

          if (data.isVideoDisabledByHost) {
            mem.setIsVideoEnabled(false);
            mem.videoStreamRef.current?.getVideoTracks().forEach(t => t.enabled = false);
            socket.emit("user-video", false); 
          }
        } else {
          // Targeting remote peer, update PeerData
          mem.setPeers((prev) => {
            const updated = new Map<string, PeerData>(prev);
            const peer = updated.get(data.userId);
            if (peer) {
              updated.set(data.userId, {
                ...peer,
                isMutedByHost: data.isMutedByHost,
                isVideoDisabledByHost: data.isVideoDisabledByHost,
                // also forcibly update their regular status locally so UI reflects it immediately
                isMuted: data.isMutedByHost ? true : peer.isMuted,
                isVideoEnabled: data.isVideoDisabledByHost ? false : peer.isVideoEnabled
              });
            }
            return updated;
          });
        }
      });

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
        memoryRef.current.addActivity({ type: "chat", userName: msg.userName, timestamp: msg.timestamp });
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
      if (memory.audioContextRef.current && memory.audioContextRef.current.state !== "closed") {
        memory.audioContextRef.current.close().catch(err => console.log("AudioContext close:", err));
      }
      memory.analyserNodesRef.current.clear();
      memory.iceCandidateBufferRef.current.clear();
      memory.makingOfferRef.current.clear();
      memory.negotiationDoneRef.current.clear();
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

  const sendChatMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    const memory = memoryRef.current;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      userId,
      userName,
      message: message.trim(),
      timestamp: Date.now()
    };
    memory.setChatMessages((prev) => [...prev, { ...msg, isLocal: true }]);
    memory.socketRef.current?.emit("chat-message", msg);
  }, [userId, userName, memoryRef]);

  const disconnect = useCallback(() => {
    memoryRef.current.socketRef.current?.disconnect();
  }, [memoryRef]);

  const triggerHostAction = useCallback((targetUserId: string, action: "mute" | "unmute" | "disableVideo" | "enableVideo") => {
    const memory = memoryRef.current;
    if (memory.userRole !== "host") return;

    if (action === "mute" || action === "unmute") {
      memory.socketRef.current?.emit("host-mute-user", { targetUserId, action });
    } else {
      memory.socketRef.current?.emit("host-disable-video", { targetUserId, action });
    }
  }, [memoryRef]);

  return {
    sendChatMessage,
    disconnect,
    triggerHostAction
  };
}
