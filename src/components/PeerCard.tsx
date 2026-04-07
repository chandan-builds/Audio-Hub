import { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PeerData } from "@/src/hooks/useWebRTC";

interface PeerCardProps {
  peer: PeerData;
  isLocal?: boolean;
  localUserName?: string;
  isMuted?: boolean;
  isSharingScreen?: boolean;
  localStream?: MediaStream | null;
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
  const stream = isLocal ? localStream : peer.stream;
  const muted = isLocal ? isMuted : peer.isMuted;
  const sharing = isLocal ? isSharingScreen : peer.isSharingScreen;
  const hasVideo = stream ? stream.getVideoTracks().length > 0 : false;
  const audioLevel = isLocal ? 0 : peer.audioLevel;

  useEffect(() => {
    if (videoRef.current && stream && hasVideo) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, hasVideo]);

  useEffect(() => {
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, isLocal]);

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
          "bg-zinc-900/50 border-zinc-800/60 overflow-hidden backdrop-blur-sm transition-all duration-300 hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/20",
          isLocal && "ring-1 ring-zinc-700/40 bg-zinc-900/70",
          audioLevel > 0.2 && !isLocal && "ring-2 ring-emerald-500/30 border-emerald-800/30"
        )}
      >
        <CardContent className="p-5 flex flex-col items-center gap-4">
          {/* Avatar with audio ring */}
          <div className="relative">
            <div className="relative">
              <Avatar className={cn(
                "h-20 w-20 border-2 transition-colors duration-300",
                isLocal ? "border-zinc-600" : "border-zinc-800",
                audioLevel > 0.2 && !isLocal && "border-emerald-600/50"
              )}>
                <AvatarFallback className={cn(
                  "text-xl font-bold",
                  isLocal
                    ? "bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-200"
                    : "bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-400"
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
            <p className={cn("font-semibold", isLocal ? "text-zinc-100" : "text-zinc-200")}>
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
}
