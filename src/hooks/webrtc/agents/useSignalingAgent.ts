import { useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { useStableMemory } from "../memory/useWebRTCMemory";
import { fetchTurnCredentials } from "../tools/networkTools";
import { setOpusLowLatency } from "../tools/sdpTools";
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
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
            latency: 0 as unknown,
          } as MediaTrackConstraints,
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
        });
      });

      socket.on("user-connected", (newUserId: string, newUserName: string) => {
        if (!mounted) return;
        console.log(`[Room] ${newUserName} connected`);
        createPeerRef.current(newUserId, newUserName, true);
        memory.addActivity({ type: "join", userName: newUserName, timestamp: Date.now() });
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

      socket.on("user-status-changed", ({ userId: changedUserId, isMuted: muted, isSharingScreen: sharing }: any) => {
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
            updated.set(changedUserId, newData);
          }
          return updated;
        });
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
      memory.setChatMessages([]);
      memory.setIsConnected(false);
      memory.setIsSharingScreen(false);
      memory.setIsMuted(false);
    };
    // Only re-run when roomId, userId, userName, or serverUrl change.
    // All callback refs and memoryRef are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, userName, serverUrl]);

  const sendChatMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    const memory = memoryRef.current;
    const msg: ChatMessage = {
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

  return {
    sendChatMessage,
    disconnect
  };
}
