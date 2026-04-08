import { useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { useWebRTCMemory } from "../memory/useWebRTCMemory";
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
  const memory = useWebRTCMemory();

  const connectAndSignal = useCallback(async () => {
    let mounted = true;

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
      setupAudioAnalyser(stream, "local");
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
        createPeerConnection(user.userId, user.userName, false);
        memory.addActivity({ type: "join", userName: user.userName, timestamp: Date.now() });
      });
    });

    socket.on("user-connected", (newUserId: string, newUserName: string) => {
      if (!mounted) return;
      console.log(`[Room] ${newUserName} connected`);
      createPeerConnection(newUserId, newUserName, true);
      memory.addActivity({ type: "join", userName: newUserName, timestamp: Date.now() });
    });

    socket.on("signal", async ({ from, fromName, signal, type }: any) => {
      if (!mounted) return;

      let peer = memory.peersRef.current.get(from);
      let pc = peer?.connection;

      if (!pc) {
        pc = createPeerConnection(from, fromName, false);
      }

      try {
        if (type === "offer") {
          const polite = memory.politeRef.current.get(from) ?? false;
          const makingOffer = memory.makingOfferRef.current.get(from) ?? false;
          const offerCollision = makingOffer || pc.signalingState !== "stable";

          memory.ignoreOfferRef.current.set(from, !polite && offerCollision);
          if (memory.ignoreOfferRef.current.get(from)) {
            console.log(`[WebRTC] Ignoring offer collision from ${fromName} (we are impolite)`);
            return;
          }

          if (offerCollision) {
            console.log(`[WebRTC] Offer collision with ${fromName}, rolling back (we are polite)`);
            await pc.setLocalDescription({ type: "rollback" });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          await flushIceCandidates(from, pc);

          await pc.setLocalDescription();
          const localDesc = pc.localDescription;
          if (!localDesc) return;
          
          const modifiedSdp = setOpusLowLatency(localDesc.sdp || "");
          const finalDesc = new RTCSessionDescription({ type: localDesc.type, sdp: modifiedSdp });
          
          if (localDesc.sdp !== modifiedSdp) {
             await pc.setLocalDescription(finalDesc);
          }
          
          socket.emit("signal", {
            to: from,
            from: userId,
            fromName: userName,
            signal: finalDesc,
            type: "answer",
          });
          memory.negotiationDoneRef.current.set(from, true);
        } else if (type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          await flushIceCandidates(from, pc);
          memory.negotiationDoneRef.current.set(from, true);
        } else if (type === "candidate") {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal));
            } catch (err) {
              if (!memory.ignoreOfferRef.current.get(from)) {
                console.error(`[ICE] Error adding candidate from ${fromName}`, err);
              }
            }
          } else {
            if (!memory.ignoreOfferRef.current.get(from)) {
              console.log(`[ICE] Buffering candidate from ${fromName}`);
              const buffer = memory.iceCandidateBufferRef.current.get(from) || [];
              buffer.push(signal);
              memory.iceCandidateBufferRef.current.set(from, buffer);
            }
          }
        }
      } catch (err) {
        console.error(`[Signal] Error handling ${type}:`, err);
      }
    });

    socket.on("user-disconnected", (disconnectedUserId: string) => {
      if (!mounted) return;
      const peer = memory.peersRef.current.get(disconnectedUserId);
      if (peer) {
        memory.addActivity({ type: "leave", userName: peer.userName, timestamp: Date.now() });
      }
      cleanupPeer(disconnectedUserId);
    });

    socket.on("user-status-changed", ({ userId: changedUserId, isMuted: muted, isSharingScreen: sharing }: any) => {
      if (!mounted) return;
      memory.setPeers((prev) => {
        const updated = new Map<string, PeerData>(prev);
        const existing = updated.get(changedUserId);
        if (existing) {
          const newData = { ...(existing as PeerData) };
          if (muted !== undefined) {
            newData.isMuted = muted;
            memory.addActivity({ type: muted ? "mute" : "unmute", userName: (existing as PeerData).userName, timestamp: Date.now() });
          }
          if (sharing !== undefined) {
            newData.isSharingScreen = sharing;
            memory.addActivity({ type: sharing ? "screen-share" : "screen-stop", userName: (existing as PeerData).userName, timestamp: Date.now() });
          }
          updated.set(changedUserId, newData);
        }
        return updated;
      });
    });

    socket.on("room-user-count", (count: number) => {
      if (!mounted) return;
      memory.setRoomUserCount(count);
    });

    socket.on("chat-message", (msg: ChatMessage) => {
      if (!mounted) return;
      memory.setChatMessages((prev) => [...prev, msg]);
      memory.addActivity({ type: "chat", userName: msg.userName, timestamp: msg.timestamp });
    });

    return () => {
      mounted = false;
    };
  }, [roomId, userId, userName, serverUrl, createPeerConnection, cleanupPeer, flushIceCandidates, setupAudioAnalyser, memory]);

  useEffect(() => {
    if (!roomId) return;
    const cleanup = connectAndSignal();

    return () => {
      cleanup.then(fn => fn?.());
      
      memory.localStreamRef.current?.getTracks().forEach((t) => t.stop());
      memory.screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      memory.peersRef.current.forEach((peer) => peer.connection.close());
      memory.peersRef.current.clear();
      memory.audioContextRef.current?.close();
      memory.analyserNodesRef.current.clear();
      memory.iceCandidateBufferRef.current.clear();
      memory.makingOfferRef.current.clear();
      memory.negotiationDoneRef.current.clear();
      memory.socketRef.current?.disconnect();
      
      memory.setPeers(new Map());
      memory.setLocalStream(null);
      memory.setLocalScreenStream(null);
      memory.setChatMessages([]);
      memory.setActivityLog([]);
      memory.setIsConnected(false);
      memory.setIsSharingScreen(false);
      memory.setIsMuted(false);
    };
  }, [roomId, connectAndSignal, memory]);

  const sendChatMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    const msg: ChatMessage = {
      userId,
      userName,
      message: message.trim(),
      timestamp: Date.now()
    };
    memory.setChatMessages((prev) => [...prev, { ...msg, isLocal: true }]);
    memory.socketRef.current?.emit("chat-message", msg);
  }, [userId, userName, memory]);

  const disconnect = useCallback(() => {
    memory.socketRef.current?.disconnect();
  }, [memory]);

  return {
    sendChatMessage,
    disconnect
  };
}
