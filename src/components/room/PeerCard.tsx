// src/components/room/PeerCard.tsx
import { useRef, useEffect } from "react";
import type { Key } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PeerData } from "@/src/hooks/useWebRTC";

interface PeerCardProps {
  key?: Key;
  peer: PeerData;
  isLocal?: boolean;
  localUserName?: string;
  isMuted?: boolean;
  isSharingScreen?: boolean;
  localStream?: MediaStream | null;
}

function ConnectionDot({ state }: { state: RTCIceConnectionState | "local" }) {
  const isGood = state === "local" || state === "connected" || state === "completed";
  const isWarn = state === "checking" || state === "new";
  
  const color = isGood
      ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
      : isWarn
      ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
      : "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]";

  return (
    <div className={cn("absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-[#18181b] flex items-center justify-center", color)}>
      {isGood && (
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={cn("absolute inset-0 rounded-full", color)}
        />
      )}
    </div>
  );
}

function AudioRing({ level }: { level: number }) {
  return (
    <>
      <motion.div
        animate={{ scale: 1 + level * 0.2, opacity: 0.2 + level * 0.3 }}
        transition={{ duration: 0.05 }}
        className="absolute inset-0 rounded-full border border-violet-400/40"
      />
      {level > 0.1 && (
        <motion.div
          animate={{ scale: 1 + level * 0.4, opacity: level * 0.2 }}
          transition={{ duration: 0.05 }}
          className="absolute inset-0 rounded-full border-2 border-violet-400/30"
        />
      )}
    </>
  );
}

export function PeerCard({
  peer,
  isLocal,
  localUserName,
  isMuted,
  isSharingScreen,
  localStream,
}: PeerCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const name = isLocal ? localUserName || "You" : peer.userName;
  const audioStream = isLocal ? localStream : peer.stream;
  const videoStream = peer.screenStream;
  const muted = isLocal ? isMuted : peer.isMuted;
  const sharing = isLocal ? isSharingScreen : peer.isSharingScreen;
  const hasVideo = !!videoStream;
  const audioLevel = isLocal ? 0 : peer.audioLevel; // Local audio level not implemented natively yet, could be added later
  const isSpeaking = audioLevel > 0.1;

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  useEffect(() => {
    if (audioRef.current && audioStream && !isLocal) {
      audioRef.current.srcObject = audioStream;
      audioRef.current.volume = 1.0;
      audioRef.current.play().catch((err) => {
        console.warn("[Audio] Autoplay blocked, will retry on user interaction:", err);
        const resumeAudio = () => {
          audioRef.current?.play().catch(() => {});
          document.removeEventListener("click", resumeAudio);
          document.removeEventListener("keydown", resumeAudio);
        };
        document.addEventListener("click", resumeAudio);
        document.addEventListener("keydown", resumeAudio);
      });
    }
  }, [audioStream, isLocal]);

  // Generate a distinct gradient based on name
  const gradientHash = name.charCodeAt(0) % 5;
  const gradients = [
    "from-violet-600 to-indigo-600",
    "from-blue-600 to-cyan-600",
    "from-emerald-600 to-teal-600",
    "from-rose-600 to-pink-600",
    "from-amber-600 to-orange-600"
  ];
  
  const bgGradient = gradients[gradientHash];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="group relative"
      layoutId={`peer-${isLocal ? "local" : peer.userId}`}
    >
      <Card
        className={cn(
          "bg-[#18181b]/80 border-zinc-800/80 overflow-hidden backdrop-blur-2xl transition-all duration-300 rounded-3xl",
          isLocal && "ring-1 ring-violet-500/30 bg-[#18181b]/90 shadow-lg shadow-violet-900/10",
          !isLocal && "hover:border-zinc-700/80 hover:shadow-xl hover:shadow-black/40",
          isSpeaking && !isLocal && "ring-2 ring-violet-500/50 border-violet-800/50 shadow-lg shadow-violet-900/20"
        )}
      >
        <CardContent className="p-6 flex flex-col items-center gap-5">
          {/* Avatar with audio ring */}
          <div className="relative">
            <div className="relative">
              <Avatar className={cn(
                "h-24 w-24 border-4 transition-colors duration-300 shadow-xl",
                isLocal ? "border-zinc-800/80" : "border-zinc-800/50",
                isSpeaking && !isLocal && "border-violet-600/50 shadow-violet-900/50"
              )}>
                <AvatarFallback className={cn(
                  "text-3xl font-black bg-gradient-to-br text-white",
                  isLocal ? "from-violet-600 to-fuchsia-600" : bgGradient
                )}>
                  {name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <AudioRing level={audioLevel} />
              <ConnectionDot state={isLocal ? "local" : peer.connectionState} />
            </div>
            
            {/* Action indicator float */}
            <AnimatePresence>
              {muted && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  className="absolute -top-2 -right-2 bg-red-500 h-8 w-8 rounded-full border-2 border-[#18181b] flex items-center justify-center shadow-lg"
                >
                  <div className="h-0.5 w-4 bg-white rotate-45 rounded-full absolute" />
                  <div className="h-0.5 w-4 bg-white -rotate-45 rounded-full absolute" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Name and status */}
          <div className="text-center space-y-1.5 min-w-0 w-full">
            <p className={cn("font-bold text-lg truncate px-2", isLocal ? "text-white" : "text-zinc-100")}>
              {name} {isLocal && <span className="text-violet-400 font-medium text-sm ml-1">(You)</span>}
            </p>
            <div className="flex items-center justify-center gap-2 h-5">
              {sharing && (
                <Badge variant="outline" className="text-[9px] border-cyan-800 text-cyan-300 bg-cyan-950/40 px-2 shadow-sm shadow-cyan-900/20">
                  SHARING SCREEN
                </Badge>
              )}
              {!muted && !sharing && (
                <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
                  {isLocal ? "Broadcasting" : "Connected"}
                </p>
              )}
            </div>
          </div>

          {/* Video (screen share) preview in card */}
          {hasVideo && (
            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-inner mt-2">
              <video
                ref={videoRef}
                autoPlay
                muted={isLocal}
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Audio element for remote peers */}
          {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
        </CardContent>
      </Card>
    </motion.div>
  );
}
