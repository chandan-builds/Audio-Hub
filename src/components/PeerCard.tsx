import { useRef, useEffect, useState, memo } from "react";
import type { Key } from "react";
import { motion } from "motion/react";
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
  volume?: number;
}

function ConnectionDot({ state }: { state: RTCIceConnectionState | "local" }) {
  const color =
    state === "local" || state === "connected" || state === "completed"
      ? "bg-emerald-400 shadow-emerald-400/40"
      : state === "checking" || state === "new"
      ? "bg-amber-400 shadow-amber-400/40"
      : "bg-red-400 shadow-red-400/40";

  return (
    <div className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 shadow-md", color)}>
      {(state === "local" || state === "connected" || state === "completed") && (
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0, 1] }}
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
        animate={{ scale: 1 + level * 0.3, opacity: 0.2 + level * 0.3 }}
        transition={{ duration: 0.1 }}
        className="absolute inset-0 rounded-full border-2 border-emerald-400/30"
      />
      {level > 0.15 && (
        <motion.div
          animate={{ scale: 1 + level * 0.5, opacity: level * 0.2 }}
          transition={{ duration: 0.1 }}
          className="absolute inset-0 rounded-full border border-emerald-400/20"
        />
      )}
    </>
  );
}

export const PeerCard = memo(function PeerCard({
  peer,
  isLocal,
  localUserName,
  isMuted,
  isSharingScreen,
  localStream,
  volume = 1.0,
}: PeerCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const name = isLocal ? localUserName || "You" : peer.userName;
  const audioStream = isLocal ? localStream : peer.stream;
  const videoStream = peer.screenStream;
  const muted = isLocal ? isMuted : peer.isMuted;
  const sharing = isLocal ? isSharingScreen : peer.isSharingScreen;
  const hasVideo = !!videoStream;
  const audioLevel = isLocal ? 0 : peer.audioLevel;

  useEffect(() => {
    if (videoRef.current && videoStream) {
      if (videoRef.current.srcObject !== videoStream) {
        videoRef.current.srcObject = videoStream;
      }
    }
  }, [videoStream]);

  useEffect(() => {
    if (audioRef.current && audioStream && !isLocal) {
      if (audioRef.current.srcObject !== audioStream) {
        audioRef.current.srcObject = audioStream;
        audioRef.current.volume = volume;
        // Explicitly play — autoplay may be blocked by browser policy
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
    }
  }, [audioStream, isLocal, volume]);

  useEffect(() => {
    if (audioRef.current && !isLocal) {
      audioRef.current.volume = volume;
    }
  }, [volume, isLocal]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="group"
      layout
    >
      <Card
        className={cn(
          "bg-white/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60 overflow-hidden backdrop-blur-md transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700/80 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-black/20",
          isLocal && "ring-1 ring-violet-200 dark:ring-zinc-700/40 bg-white/95 dark:bg-zinc-900/70",
          audioLevel > 0.2 && !isLocal && "ring-2 ring-emerald-500/30 border-emerald-500/30 dark:border-emerald-800/30"
        )}
      >
        <CardContent className="p-5 flex flex-col items-center gap-4">
          {/* Avatar with audio ring */}
          <div className="relative">
            <div className="relative">
              <Avatar className={cn(
                "h-20 w-20 border-2 transition-colors duration-300",
                isLocal ? "border-violet-200 dark:border-zinc-600" : "border-zinc-200 dark:border-zinc-800",
                audioLevel > 0.2 && !isLocal && "border-emerald-400 dark:border-emerald-600/50"
              )}>
                <AvatarFallback className={cn(
                  "text-xl font-bold",
                  isLocal
                    ? "bg-gradient-to-br from-violet-100 to-violet-200 text-violet-700 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-200"
                    : "bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-600 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-400"
                )}>
                  {name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <AudioRing level={audioLevel} />
              <ConnectionDot state={isLocal ? "local" : peer.connectionState} />
            </div>
          </div>

          {/* Name and status */}
          <div className="text-center space-y-1">
            <p className={cn("font-semibold text-zinc-900 dark:text-zinc-100")}>
              {name} {isLocal && <span className="text-zinc-500 font-normal">(You)</span>}
            </p>
            <div className="flex items-center justify-center gap-2">
              {muted && (
                <Badge variant="outline" className="text-[10px] border-red-900/40 text-red-400 bg-red-950/20 px-1.5">
                  MUTED
                </Badge>
              )}
              {sharing && (
                <Badge variant="outline" className="text-[10px] border-cyan-900/40 text-cyan-400 bg-cyan-950/20 px-1.5">
                  SHARING
                </Badge>
              )}
              {!muted && !sharing && (
                <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
                  {isLocal ? "Broadcasting" : "Connected"}
                </p>
              )}
            </div>
          </div>

          {/* Video (screen share) */}
          {hasVideo && (
            <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800/50 shadow-inner">
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
});
