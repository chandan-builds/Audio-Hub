import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { 
  Mic, MicOff, Monitor, MonitorOff, PhoneOff, 
  Users, Globe, Volume2, Settings, MessageSquare,
  ChevronRight, Share2, Shield, Radio
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// --- Types ---
interface PeerConnection {
  connection: RTCPeerConnection;
  stream: MediaStream | null;
  userName: string;
}

// --- Constants ---
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function App() {
  // --- State ---
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [userId] = useState(() => Math.random().toString(36).substring(7));
  const [isMuted, setIsMuted] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [peers, setPeers] = useState<Record<string, PeerConnection>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Refs ---
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});

  // --- WebRTC Logic ---
  const createPeerConnection = useCallback((targetUserId: string, targetUserName: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[targetUserId] = pc;

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("signal", {
          to: targetUserId,
          from: userId,
          signal: event.candidate,
          type: "candidate"
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      setPeers(prev => ({
        ...prev,
        [targetUserId]: {
          ...prev[targetUserId],
          stream: event.streams[0],
          userName: targetUserName
        }
      }));
    };

    // If initiator, create offer
    if (isInitiator) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        socketRef.current?.emit("signal", {
          to: targetUserId,
          from: userId,
          signal: offer,
          type: "offer"
        });
      });
    }

    return pc;
  }, [userId]);

  const joinRoom = async () => {
    if (!roomId || !userName) {
      setError("Please enter a room ID and your name.");
      return;
    }

    try {
      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Connect to socket
      socketRef.current = io();
      socketRef.current.emit("join-room", roomId, userId, userName);

      // Handle signaling
      socketRef.current.on("user-connected", (newUserId, newUserName) => {
        console.log("User connected:", newUserId);
        createPeerConnection(newUserId, newUserName, true);
      });

      socketRef.current.on("signal", async ({ from, signal, type }) => {
        let pc = peersRef.current[from];
        
        if (!pc) {
          pc = createPeerConnection(from, "Unknown", false);
        }

        if (type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current?.emit("signal", {
            to: from,
            from: userId,
            signal: answer,
            type: "answer"
          });
        } else if (type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (type === "candidate") {
          await pc.addIceCandidate(new RTCIceCandidate(signal));
        }
      });

      socketRef.current.on("user-disconnected", (disconnectedUserId) => {
        const pc = peersRef.current[disconnectedUserId];
        if (pc) {
          pc.close();
          delete peersRef.current[disconnectedUserId];
          setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[disconnectedUserId];
            return newPeers;
          });
        }
      });

      setInRoom(true);
      setError(null);
    } catch (err) {
      console.error("Error joining room:", err);
      setError("Could not access microphone. Please check permissions.");
    }
  };

  const leaveRoom = () => {
    socketRef.current?.disconnect();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    (Object.values(peersRef.current) as RTCPeerConnection[]).forEach(pc => pc.close());
    peersRef.current = {};
    setPeers({});
    setLocalStream(null);
    setInRoom(false);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      // Stop screen sharing, revert to audio only
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      replaceStream(stream);
      setIsSharingScreen(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        replaceStream(screenStream);
        setIsSharingScreen(true);
        
        // Handle stop sharing from browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.error("Error sharing screen:", err);
      }
    }
  };

  const replaceStream = (newStream: MediaStream) => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = newStream;
    setLocalStream(newStream);

    (Object.values(peersRef.current) as RTCPeerConnection[]).forEach(pc => {
      const senders = pc.getSenders();
      newStream.getTracks().forEach(track => {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          pc.addTrack(track, newStream);
        }
      });
    });
  };

  // --- Render Helpers ---
  const renderPeer = (peerId: string, peer: PeerConnection) => (
    <motion.div
      key={peerId}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative group"
    >
      <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden backdrop-blur-sm hover:border-zinc-700 transition-colors">
        <CardContent className="p-4 flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20 border-2 border-zinc-800">
              <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xl">
                {peer.userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-green-500 h-4 w-4 rounded-full border-2 border-zinc-900" />
          </div>
          <div className="text-center">
            <p className="font-medium text-zinc-200">{peer.userName}</p>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Connected</p>
          </div>
          
          {peer.stream && peer.stream.getVideoTracks().length > 0 && (
            <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800">
              <video
                autoPlay
                playsInline
                ref={(el) => { if (el) el.srcObject = peer.stream; }}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          
          {/* Hidden audio element for the peer */}
          <audio
            autoPlay
            ref={(el) => { if (el) el.srcObject = peer.stream; }}
          />
        </CardContent>
      </Card>
    </motion.div>
  );

  // --- Main Render ---
  return (
    <TooltipProvider>
      <div className="dark min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-zinc-800">
        {/* Background Atmosphere */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-900/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-900/20 rounded-full blur-[120px]" />
        </div>

        {!inRoom ? (
          <div className="relative flex items-center justify-center min-h-screen p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md"
            >
              <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center space-y-2">
                  <div className="flex justify-center mb-2">
                    <div className="p-3 bg-zinc-800/50 rounded-2xl border border-zinc-700">
                      <Radio className="h-8 w-8 text-zinc-200 animate-pulse" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold tracking-tight text-zinc-100">Voice Hub</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Join a global room to chat and share your screen.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 ml-1">Display Name</label>
                    <Input
                      placeholder="Enter your name..."
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="bg-zinc-950/50 border-zinc-800 focus:ring-zinc-700 h-12 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 ml-1">Room ID</label>
                    <div className="relative">
                      <Input
                        placeholder="e.g. global-chat"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        className="bg-zinc-950/50 border-zinc-800 focus:ring-zinc-700 h-12 pr-10 text-zinc-100"
                      />
                      <Globe className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                    </div>
                  </div>
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      className="text-sm text-red-400 bg-red-950/20 p-3 rounded-lg border border-red-900/30"
                    >
                      {error}
                    </motion.p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={joinRoom}
                    className="w-full h-12 bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-bold text-lg transition-all active:scale-[0.98]"
                  >
                    Join Room
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                </CardFooter>
              </Card>
              
              <div className="mt-8 flex justify-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <Shield className="h-3 w-3" />
                  ENCRYPTED
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <Globe className="h-3 w-3" />
                  GLOBAL
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <Radio className="h-3 w-3" />
                  LOW LATENCY
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col h-screen">
            {/* Header */}
            <header className="h-16 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md flex items-center justify-between px-6 z-10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-zinc-400" />
                  <h1 className="font-bold tracking-tight text-zinc-200">Voice Hub</h1>
                </div>
                <Separator orientation="vertical" className="h-4 bg-zinc-800" />
                <Badge variant="outline" className="bg-zinc-900/50 border-zinc-800 text-zinc-400 font-mono">
                  ROOM: {roomId}
                </Badge>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2 mr-4">
                  <Avatar className="h-8 w-8 border-2 border-zinc-950">
                    <AvatarFallback className="bg-zinc-800 text-[10px]">{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {Object.values(peers).map((peer: PeerConnection, i) => (
                    <Avatar key={i} className="h-8 w-8 border-2 border-zinc-950">
                      <AvatarFallback className="bg-zinc-900 text-[10px]">{peer.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <Button variant="outline" size="icon" className="rounded-full border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800">
                  <Settings className="h-4 w-4 text-zinc-400" />
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={leaveRoom}
                  className="bg-red-950/30 text-red-400 border border-red-900/50 hover:bg-red-900/40"
                >
                  <PhoneOff className="mr-2 h-4 w-4" />
                  Leave
                </Button>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden flex">
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {/* Local User Card */}
                    <Card className="bg-zinc-900/80 border-zinc-700 overflow-hidden shadow-xl ring-1 ring-zinc-700/50">
                      <CardContent className="p-4 flex flex-col items-center gap-4">
                        <div className="relative">
                          <Avatar className="h-20 w-20 border-2 border-zinc-600">
                            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xl">
                              {userName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 bg-green-500 h-4 w-4 rounded-full border-2 border-zinc-900" />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-zinc-100">{userName} (You)</p>
                          <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Broadcasting</p>
                        </div>
                        
                        {isSharingScreen && localStream && (
                          <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800">
                            <video
                              autoPlay
                              muted
                              playsInline
                              ref={(el) => { if (el) el.srcObject = localStream; }}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}

                        <div className="flex gap-2 w-full">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={toggleMute}
                            className={cn(
                              "flex-1 h-10 border-zinc-800 bg-zinc-950/50",
                              isMuted && "bg-red-950/20 border-red-900/50 text-red-400"
                            )}
                          >
                            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={toggleScreenShare}
                            className={cn(
                              "flex-1 h-10 border-zinc-800 bg-zinc-950/50",
                              isSharingScreen && "bg-zinc-100 text-zinc-950 border-zinc-100"
                            )}
                          >
                            {isSharingScreen ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Remote Peers */}
                    <AnimatePresence>
                      {(Object.entries(peers) as [string, PeerConnection][]).map(([id, peer]) => renderPeer(id, peer))}
                    </AnimatePresence>
                    
                    {Object.keys(peers).length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20">
                        <Users className="h-16 w-16 mb-4" />
                        <p className="text-lg font-medium">Waiting for others to join...</p>
                        <p className="text-sm font-mono">Invite someone using Room ID: {roomId}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Sidebar / Activity Feed */}
              <aside className="w-80 border-l border-zinc-800 bg-zinc-950/30 hidden xl:flex flex-col">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-zinc-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Activity</span>
                  </div>
                  <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">{Object.keys(peers).length + 1}</Badge>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    <div className="flex gap-3 items-start">
                      <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                      <div>
                        <p className="text-sm text-zinc-300 font-medium">You joined the room</p>
                        <p className="text-[10px] text-zinc-600 font-mono">JUST NOW</p>
                      </div>
                    </div>
                    {Object.values(peers).map((peer: PeerConnection, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                        <div>
                          <p className="text-sm text-zinc-300 font-medium">{peer.userName} joined</p>
                          <p className="text-[10px] text-zinc-600 font-mono">CONNECTED</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-4 border-t border-zinc-800">
                  <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Volume2 className="h-4 w-4 text-zinc-500" />
                      <span className="text-xs text-zinc-400">Output Volume</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-600">80%</span>
                  </div>
                </div>
              </aside>
            </main>

            {/* Controls Bar (Mobile/Tablet) */}
            <div className="h-20 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl xl:hidden flex items-center justify-center gap-4 px-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={toggleMute}
                    className={cn(
                      "h-12 w-12 rounded-full border-zinc-800 bg-zinc-900/50",
                      isMuted && "bg-red-950/20 border-red-900/50 text-red-400"
                    )}
                  >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mute Microphone</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={toggleScreenShare}
                    className={cn(
                      "h-12 w-12 rounded-full border-zinc-800 bg-zinc-900/50",
                      isSharingScreen && "bg-zinc-100 text-zinc-950 border-zinc-100"
                    )}
                  >
                    {isSharingScreen ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share Screen</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-8 bg-zinc-800 mx-2" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    onClick={leaveRoom}
                    className="h-12 w-12 rounded-full bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Leave Room</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
