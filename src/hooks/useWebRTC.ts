import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// --- Types ---
export interface PeerData {
  userId: string;
  userName: string;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  connection: RTCPeerConnection;
  isMuted: boolean;
  isSharingScreen: boolean;
  connectionState: RTCIceConnectionState;
  audioLevel: number;
}

export interface ChatMessage {
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  isLocal?: boolean;
}

export interface ActivityEvent {
  type: "join" | "leave" | "mute" | "unmute" | "screen-share" | "screen-stop" | "chat";
  userName: string;
  timestamp: number;
}

interface UseWebRTCOptions {
  roomId: string;
  userName: string;
  userId: string;
  serverUrl: string;
}

export interface UseWebRTCReturn {
  peers: Map<string, PeerData>;
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  isMuted: boolean;
  isSharingScreen: boolean;
  isConnected: boolean;
  chatMessages: ChatMessage[];
  activityLog: ActivityEvent[];
  roomUserCount: number;
  toggleMute: () => void;
  toggleScreenShare: () => Promise<void>;
  sendChatMessage: (message: string) => void;
  disconnect: () => void;
  getAudioDevices: () => Promise<MediaDeviceInfo[]>;
  getVideoDevices: () => Promise<MediaDeviceInfo[]>;
  switchAudioDevice: (deviceId: string) => Promise<void>;
}

// Opus SDP munging for low latency
function setOpusLowLatency(sdp: string): string {
  // Set Opus to mono, low latency
  return sdp.replace(
    /a=fmtp:111 /g,
    "a=fmtp:111 stereo=0;sprop-stereo=0;maxaveragebitrate=64000;useinbandfec=1;ptime=10;"
  );
}

export function useWebRTC({
  roomId,
  userName,
  userId,
  serverUrl,
}: UseWebRTCOptions): UseWebRTCReturn {
  const [peers, setPeers] = useState<Map<string, PeerData>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [roomUserCount, setRoomUserCount] = useState(1);

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerData>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodesRef = useRef<Map<string, AnalyserNode>>(new Map());
  // Buffer ICE candidates that arrive before remote description is set
  const iceCandidateBufferRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Track whether we are currently negotiating to prevent glare
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  // Track whether initial negotiation is complete (so renegotiation knows it can send offers)
  const negotiationDoneRef = useRef<Map<string, boolean>>(new Map());

  const addActivity = useCallback((event: ActivityEvent) => {
    setActivityLog((prev) => [event, ...prev].slice(0, 50));
  }, []);

  // Fetch TURN credentials
  const fetchTurnCredentials = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/turn-credentials`);
      const data = await res.json();
      iceServersRef.current = data.iceServers;
    } catch (err) {
      console.warn("Failed to fetch TURN credentials, using STUN only:", err);
      iceServersRef.current = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ];
    }
  }, [serverUrl]);

  // Audio level analysis
  const setupAudioAnalyser = useCallback(
    (stream: MediaStream, peerId: string) => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserNodesRef.current.set(peerId, analyser);
    },
    []
  );

  // Flush buffered ICE candidates for a peer
  const flushIceCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const buffered = iceCandidateBufferRef.current.get(peerId);
    if (buffered && buffered.length > 0) {
      console.log(`[ICE] Flushing ${buffered.length} buffered candidates for ${peerId}`);
      for (const candidate of buffered) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("[ICE] Error adding buffered candidate:", err);
        }
      }
      iceCandidateBufferRef.current.set(peerId, []);
    }
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(peerId);
      analyserNodesRef.current.delete(peerId);
      iceCandidateBufferRef.current.delete(peerId);
      makingOfferRef.current.delete(peerId);
      negotiationDoneRef.current.delete(peerId);
      setPeers((prev) => {
        const updated = new Map(prev);
        updated.delete(peerId);
        return updated;
      });
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(
    (
      targetUserId: string,
      targetUserName: string,
      isInitiator: boolean
    ): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
      });

      // Initialize state for this peer
      iceCandidateBufferRef.current.set(targetUserId, []);
      makingOfferRef.current.set(targetUserId, false);
      negotiationDoneRef.current.set(targetUserId, false);

      // Add local audio tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Also add screen share track if we're currently sharing
      if (screenStreamRef.current) {
        const videoTrack = screenStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          pc.addTrack(videoTrack, screenStreamRef.current);
        }
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit("signal", {
            to: targetUserId,
            from: userId,
            fromName: userName,
            signal: event.candidate,
            type: "candidate",
          });
        }
      };

      // Handle remote tracks — audio goes to stream, video goes to screenStream
      pc.ontrack = (event) => {
        console.log(`[WebRTC] ontrack from ${targetUserName}, kind=${event.track.kind}, streams=${event.streams.length}`);
        const incomingStream = event.streams[0];
        if (!incomingStream) return;

        if (event.track.kind === "audio") {
          setupAudioAnalyser(incomingStream, targetUserId);
          setPeers((prev) => {
            const updated = new Map<string, PeerData>(prev);
            const existing = updated.get(targetUserId);
            updated.set(targetUserId, {
              userId: targetUserId,
              userName: targetUserName,
              stream: incomingStream,
              screenStream: existing?.screenStream ?? null,
              connection: pc,
              isMuted: existing?.isMuted ?? false,
              isSharingScreen: existing?.isSharingScreen ?? false,
              connectionState: pc.iceConnectionState,
              audioLevel: 0,
            });
            return updated;
          });
          const existingRef = peersRef.current.get(targetUserId);
          peersRef.current.set(targetUserId, {
            userId: targetUserId,
            userName: targetUserName,
            stream: incomingStream,
            screenStream: existingRef?.screenStream ?? null,
            connection: pc,
            isMuted: existingRef?.isMuted ?? false,
            isSharingScreen: existingRef?.isSharingScreen ?? false,
            connectionState: pc.iceConnectionState,
            audioLevel: 0,
          });
        } else if (event.track.kind === "video") {
          // Screen share video track
          setPeers((prev) => {
            const updated = new Map<string, PeerData>(prev);
            const existing = updated.get(targetUserId);
            updated.set(targetUserId, {
              userId: targetUserId,
              userName: targetUserName,
              stream: existing?.stream ?? null,
              screenStream: incomingStream,
              connection: pc,
              isMuted: existing?.isMuted ?? false,
              isSharingScreen: true,
              connectionState: pc.iceConnectionState,
              audioLevel: existing?.audioLevel ?? 0,
            });
            return updated;
          });
          const existingRef = peersRef.current.get(targetUserId);
          peersRef.current.set(targetUserId, {
            userId: targetUserId,
            userName: targetUserName,
            stream: existingRef?.stream ?? null,
            screenStream: incomingStream,
            connection: pc,
            isMuted: existingRef?.isMuted ?? false,
            isSharingScreen: true,
            connectionState: pc.iceConnectionState,
            audioLevel: existingRef?.audioLevel ?? 0,
          });

          // When the video track ends (remote stops sharing), clear screenStream
          event.track.onended = () => {
            setPeers((prev) => {
              const updated = new Map<string, PeerData>(prev);
              const existing = updated.get(targetUserId);
              if (existing) {
                updated.set(targetUserId, { ...existing, screenStream: null, isSharingScreen: false });
              }
              return updated;
            });
            const ref = peersRef.current.get(targetUserId);
            if (ref) {
              peersRef.current.set(targetUserId, { ...ref, screenStream: null, isSharingScreen: false });
            }
          };
        }
      };

      // onnegotiationneeded — ONLY the initiator sends the initial offer.
      // After the first negotiation is complete, either side can renegotiate
      // (e.g. when adding/removing screen share tracks).
      pc.onnegotiationneeded = async () => {
        const alreadyNegotiated = negotiationDoneRef.current.get(targetUserId);

        if (!isInitiator && !alreadyNegotiated) {
          // Non-initiator during initial setup — DO NOT send an offer.
          // The initiator will send us an offer and we'll respond with an answer.
          console.log(`[WebRTC] Skipping onnegotiationneeded (non-initiator, initial) for ${targetUserName}`);
          return;
        }

        try {
          makingOfferRef.current.set(targetUserId, true);
          console.log(`[WebRTC] Sending offer to ${targetUserName} (initiator=${isInitiator}, renegotiation=${alreadyNegotiated})`);
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          // If signaling state changed while we were creating the offer, bail out
          if (pc.signalingState !== "stable") {
            console.log(`[WebRTC] Signaling state changed during createOffer, aborting`);
            return;
          }
          const modifiedSdp = setOpusLowLatency(offer.sdp || "");
          await pc.setLocalDescription(new RTCSessionDescription({
            type: offer.type,
            sdp: modifiedSdp,
          }));
          socketRef.current?.emit("signal", {
            to: targetUserId,
            from: userId,
            fromName: userName,
            signal: pc.localDescription,
            type: "offer",
          });
        } catch (err) {
          console.error("[WebRTC] Error during negotiation:", err);
        } finally {
          makingOfferRef.current.set(targetUserId, false);
        }
      };

      // Monitor ICE connection state
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log(`[ICE] ${targetUserName}: ${state}`);

        // Mark negotiation as done once we connect for the first time
        if (state === "connected" || state === "completed") {
          negotiationDoneRef.current.set(targetUserId, true);
        }

        setPeers((prev) => {
          const updated = new Map<string, PeerData>(prev);
          const existing = updated.get(targetUserId);
          if (existing) {
            updated.set(targetUserId, { ...existing, connectionState: state });
          }
          return updated;
        });

        if (state === "failed") {
          console.log(`[ICE] Attempting restart for ${targetUserName}`);
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

      // Store peer data
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

      setPeers((prev) => {
        const updated = new Map(prev);
        updated.set(targetUserId, peerData);
        return updated;
      });
      peersRef.current.set(targetUserId, peerData);

      return pc;
    },
    [userId, userName, setupAudioAnalyser, cleanupPeer]
  );

  // Audio level polling
  useEffect(() => {
    const interval = setInterval(() => {
      analyserNodesRef.current.forEach((analyser, peerId) => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const level = Math.min(avg / 128, 1);

        setPeers((prev) => {
          const updated = new Map<string, PeerData>(prev);
          const existing = updated.get(peerId);
          if (existing && Math.abs(existing.audioLevel - level) > 0.02) {
            updated.set(peerId, { ...existing, audioLevel: level });
          }
          return updated;
        });
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Main connection effect
  useEffect(() => {
    if (!roomId) return; // Don't connect until user joins a room

    let mounted = true;

    const connect = async () => {
      // 1. Fetch TURN credentials
      await fetchTurnCredentials();

      // 2. Get local audio stream with Bluetooth-optimized constraints
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

        localStreamRef.current = stream;
        setLocalStream(stream);
        setupAudioAnalyser(stream, "local");
      } catch (err) {
        console.error("[Media] Microphone access denied:", err);
        return;
      }

      // 3. Connect to signaling server
      const socket = io(serverUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        if (!mounted) return;
        setIsConnected(true);
        socket.emit("join-room", roomId, userId, userName);
        addActivity({
          type: "join",
          userName: "You",
          timestamp: Date.now(),
        });
      });

      socket.on("disconnect", () => {
        if (!mounted) return;
        setIsConnected(false);
      });

      // Handle existing users in room — WE are the new joiner,
      // so we create peer connections but do NOT initiate offers.
      // The existing users will send us offers via "user-connected".
      socket.on(
        "room-users",
        (
          users: {
            userId: string;
            userName: string;
            isMuted: boolean;
            isSharingScreen: boolean;
          }[]
        ) => {
          if (!mounted) return;
          users.forEach((user) => {
            // isInitiator = false — we wait for their offer
            createPeerConnection(user.userId, user.userName, false);
            addActivity({
              type: "join",
              userName: user.userName,
              timestamp: Date.now(),
            });
          });
        }
      );

      // Handle new user connecting — WE are already in the room,
      // so we are the initiator and create an offer for the new joiner.
      socket.on("user-connected", (newUserId: string, newUserName: string) => {
        if (!mounted) return;
        console.log(`[Room] ${newUserName} connected`);
        // isInitiator = true — onnegotiationneeded will fire and send offer
        createPeerConnection(newUserId, newUserName, true);
        addActivity({
          type: "join",
          userName: newUserName,
          timestamp: Date.now(),
        });
      });

      // Handle WebRTC signaling
      socket.on(
        "signal",
        async ({
          from,
          fromName,
          signal,
          type,
        }: {
          from: string;
          fromName: string;
          signal: any;
          type: string;
        }) => {
          if (!mounted) return;

          let peer = peersRef.current.get(from);
          let pc = peer?.connection;

          if (!pc) {
            // We received a signal from someone we don't have a connection to.
            // Create a non-initiator connection to accept their offer.
            pc = createPeerConnection(from, fromName, false);
          }

          try {
            if (type === "offer") {
              // Handle offer glare: if we're also making an offer, use polite peer pattern
              const offerCollision = makingOfferRef.current.get(from) ||
                pc.signalingState !== "stable";

              if (offerCollision) {
                // We are the "polite" peer — rollback and accept their offer
                console.log(`[WebRTC] Offer collision with ${fromName}, rolling back`);
                await pc.setLocalDescription({ type: "rollback" });
              }

              await pc.setRemoteDescription(new RTCSessionDescription(signal));
              // Flush any buffered ICE candidates now that remote description is set
              await flushIceCandidates(from, pc);

              const answer = await pc.createAnswer();
              // Apply Opus low-latency SDP munging
              const modifiedSdp = setOpusLowLatency(answer.sdp || "");
              const modifiedAnswer = new RTCSessionDescription({
                type: answer.type,
                sdp: modifiedSdp,
              });
              await pc.setLocalDescription(modifiedAnswer);
              socket.emit("signal", {
                to: from,
                from: userId,
                fromName: userName,
                signal: pc.localDescription,
                type: "answer",
              });
              // Mark negotiation complete so renegotiation works for both sides
              negotiationDoneRef.current.set(from, true);
            } else if (type === "answer") {
              await pc.setRemoteDescription(new RTCSessionDescription(signal));
              // Flush any buffered ICE candidates
              await flushIceCandidates(from, pc);
              // Mark negotiation complete so renegotiation works for both sides
              negotiationDoneRef.current.set(from, true);
            } else if (type === "candidate") {
              // Buffer the candidate if remote description isn't set yet
              if (pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(new RTCIceCandidate(signal));
              } else {
                console.log(`[ICE] Buffering candidate from ${fromName} (no remote description yet)`);
                const buffer = iceCandidateBufferRef.current.get(from) || [];
                buffer.push(signal);
                iceCandidateBufferRef.current.set(from, buffer);
              }
            }
          } catch (err) {
            console.error(`[Signal] Error handling ${type}:`, err);
          }
        }
      );

      // Handle user disconnect
      socket.on("user-disconnected", (disconnectedUserId: string) => {
        if (!mounted) return;
        const peer = peersRef.current.get(disconnectedUserId);
        if (peer) {
          addActivity({
            type: "leave",
            userName: peer.userName,
            timestamp: Date.now(),
          });
        }
        cleanupPeer(disconnectedUserId);
      });

      // Handle user status changes
      socket.on(
        "user-status-changed",
        ({
          userId: changedUserId,
          isMuted: muted,
          isSharingScreen: sharing,
        }: {
          userId: string;
          isMuted?: boolean;
          isSharingScreen?: boolean;
        }) => {
          if (!mounted) return;
          setPeers((prev) => {
            const updated = new Map<string, PeerData>(prev);
            const existing = updated.get(changedUserId);
            if (existing) {
              const newData: PeerData = { ...existing };
              if (muted !== undefined) {
                newData.isMuted = muted;
                addActivity({
                  type: muted ? "mute" : "unmute",
                  userName: existing.userName,
                  timestamp: Date.now(),
                });
              }
              if (sharing !== undefined) {
                newData.isSharingScreen = sharing;
                addActivity({
                  type: sharing ? "screen-share" : "screen-stop",
                  userName: existing.userName,
                  timestamp: Date.now(),
                });
              }
              updated.set(changedUserId, newData);
            }
            return updated;
          });
        }
      );

      // Handle room user count
      socket.on("room-user-count", (count: number) => {
        if (!mounted) return;
        setRoomUserCount(count);
      });

      // Handle chat messages
      socket.on("chat-message", (msg: ChatMessage) => {
        if (!mounted) return;
        setChatMessages((prev) => [...prev, msg]);
        addActivity({
          type: "chat",
          userName: msg.userName,
          timestamp: msg.timestamp,
        });
      });
    };

    connect();

    return () => {
      mounted = false;

      // Cleanup streams
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());

      // Cleanup peer connections
      peersRef.current.forEach((peer) => peer.connection.close());
      peersRef.current.clear();

      // Cleanup audio context
      audioContextRef.current?.close();
      analyserNodesRef.current.clear();

      // Cleanup buffers
      iceCandidateBufferRef.current.clear();
      makingOfferRef.current.clear();
      negotiationDoneRef.current.clear();

      // Disconnect socket
      socketRef.current?.disconnect();
    };
  }, [
    roomId,
    userId,
    userName,
    serverUrl,
    fetchTurnCredentials,
    createPeerConnection,
    cleanupPeer,
    setupAudioAnalyser,
    addActivity,
    flushIceCandidates,
  ]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        setIsMuted(newMuted);
        socketRef.current?.emit("user-muted", newMuted);
      }
    }
  }, []);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (isSharingScreen) {
      // Stop screen sharing — remove video track, keep audio
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;

      // Remove video senders from all peers
      // (onnegotiationneeded will fire automatically and renegotiate)
      peersRef.current.forEach((peer) => {
        const senders = peer.connection.getSenders();
        senders.forEach((sender) => {
          if (sender.track?.kind === "video") {
            peer.connection.removeTrack(sender);
          }
        });
      });

      setIsSharingScreen(false);
      socketRef.current?.emit("user-screen-share", false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as MediaTrackConstraints,
          audio: false,
        });

        screenStreamRef.current = screenStream;

        // Add video track to all peer connections
        // (onnegotiationneeded will fire automatically and renegotiate)
        const videoTrack = screenStream.getVideoTracks()[0];
        peersRef.current.forEach((peer) => {
          peer.connection.addTrack(videoTrack, screenStream);
        });

        // Handle browser stop sharing
        videoTrack.onended = () => {
          screenStreamRef.current?.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;

          peersRef.current.forEach((peer) => {
            const senders = peer.connection.getSenders();
            senders.forEach((sender) => {
              if (sender.track?.kind === "video") {
                peer.connection.removeTrack(sender);
              }
            });
          });

          setIsSharingScreen(false);
          socketRef.current?.emit("user-screen-share", false);
        };

        setIsSharingScreen(true);
        socketRef.current?.emit("user-screen-share", true);
      } catch (err) {
        console.error("[Screen] Share failed:", err);
      }
    }
  }, [isSharingScreen]);

  // Send chat message
  const sendChatMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return;

      const msg: ChatMessage = {
        userId,
        userName,
        message: message.trim(),
        timestamp: Date.now(),
        isLocal: true,
      };

      setChatMessages((prev) => [...prev, msg]);
      socketRef.current?.emit("chat-message", { message: msg.message, userName });
    },
    [userId, userName]
  );

  // Disconnect
  const disconnect = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    peersRef.current.forEach((peer) => peer.connection.close());
    peersRef.current.clear();
    audioContextRef.current?.close();
    analyserNodesRef.current.clear();
    iceCandidateBufferRef.current.clear();
    makingOfferRef.current.clear();
    negotiationDoneRef.current.clear();
    socketRef.current?.disconnect();
    setPeers(new Map());
    setLocalStream(null);
    setIsMuted(false);
    setIsSharingScreen(false);
    setIsConnected(false);
  }, []);

  // Get audio devices
  const getAudioDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  }, []);

  // Get video devices
  const getVideoDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput");
  }, []);

  // Switch audio input device
  const switchAudioDevice = useCallback(
    async (deviceId: string) => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
            latency: 0 as unknown,
          } as MediaTrackConstraints,
        });

        // Stop old audio tracks
        localStreamRef.current
          ?.getAudioTracks()
          .forEach((t) => t.stop());

        const newAudioTrack = newStream.getAudioTracks()[0];

        // Replace track in all peer connections
        peersRef.current.forEach((peer) => {
          const sender = peer.connection
            .getSenders()
            .find((s) => s.track?.kind === "audio");
          if (sender) {
            sender.replaceTrack(newAudioTrack);
          }
        });

        // Update local stream
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => {
            localStreamRef.current!.removeTrack(t);
          });
          localStreamRef.current.addTrack(newAudioTrack);
        } else {
          localStreamRef.current = newStream;
        }

        setLocalStream(localStreamRef.current);
        setupAudioAnalyser(localStreamRef.current!, "local");
      } catch (err) {
        console.error("[Device] Switch failed:", err);
      }
    },
    [setupAudioAnalyser]
  );

  return {
    peers,
    localStream,
    localScreenStream: screenStreamRef.current,
    isMuted,
    isSharingScreen,
    isConnected,
    chatMessages,
    activityLog,
    roomUserCount,
    toggleMute,
    toggleScreenShare,
    sendChatMessage,
    disconnect,
    getAudioDevices,
    getVideoDevices,
    switchAudioDevice,
  };
}
