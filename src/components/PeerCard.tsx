import { useRef, useEffect, memo } from "react";
import type { Key } from "react";
import { motion } from "motion/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, Maximize2, MicOff, Mic, VideoOff, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PeerData } from "@/src/hooks/useWebRTC";
import { useVisibilityPause } from "@/src/hooks/useVisibilityPause";

interface PeerCardProps {
  key?: Key;
  peer: PeerData;
  isLocal?: boolean;
  localUserName?: string;
  isMuted?: boolean;
  isSharingScreen?: boolean;
  isVideoEnabled?: boolean;
  localStream?: MediaStream | null;
  localVideoStream?: MediaStream | null;
  volume?: number;
  isActiveSpeaker?: boolean;
  onClickFocus?: () => void;
  isFocusTarget?: boolean;
  localUserRole?: "host" | "participant" | "unknown";
  onHostAction?: (targetUserId: string, action: "mute" | "unmute" | "disableVideo" | "enableVideo") => void;
}

function ConnectionDot({ state }: { state: RTCIceConnectionState | "local" }) {
  const color =
    state === "local" || state === "connected" || state === "completed"
      ? "bg-emerald-400 shadow-emerald-400/40"
      : state === "checking" || state === "new"
      ? "bg-amber-400 shadow-amber-400/40"
      : "bg-red-400 shadow-red-400/40";

  return (
    <div className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-zinc-900 shadow-md", color)}>
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

/** Active speaker glow effect */
function SpeakerGlow() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-500/20 via-cyan-500/10 to-emerald-500/20 blur-sm pointer-events-none"
    />
  );
}

export const PeerCard = memo(function PeerCard({
  peer,
  isLocal,
  localUserName,
  isMuted,
  isSharingScreen,
  isVideoEnabled,
  localStream,
  localVideoStream,
  volume = 1.0,
  isActiveSpeaker = false,
  onClickFocus,
  isFocusTarget = false,
  localUserRole,
  onHostAction,
}: PeerCardProps) {
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const name = isLocal ? localUserName || "You" : peer.userName;
  const audioStream = isLocal ? localStream : peer.stream;
  const screenStream = peer.screenStream;
  const cameraStream = isLocal ? localVideoStream : peer.videoStream;
  const muted = isLocal ? isMuted : peer.isMuted;
  const sharing = isLocal ? isSharingScreen : peer.isSharingScreen;
  const videoOn = isLocal ? isVideoEnabled : peer.isVideoEnabled;
  const hasScreenVideo = !!screenStream;
  const hasCameraVideo = !!cameraStream;
  const audioLevel = isLocal ? 0 : peer.audioLevel;
  const speaking = isLocal ? false : peer.isSpeaking;

  // Pause off-screen remote video tracks (performance optimization)
  const { containerRef: visibilityRef } = useVisibilityPause(
    !isLocal ? cameraStream : undefined
  );

  // Bind screen share video
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      if (screenVideoRef.current.srcObject !== screenStream) {
        screenVideoRef.current.srcObject = screenStream;
      }
    }
  }, [screenStream]);

  // Bind camera video
  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      if (cameraVideoRef.current.srcObject !== cameraStream) {
        cameraVideoRef.current.srcObject = cameraStream;
      }
    } else if (cameraVideoRef.current && !cameraStream) {
      cameraVideoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  // Bind audio
  useEffect(() => {
    if (audioRef.current && audioStream && !isLocal) {
      if (audioRef.current.srcObject !== audioStream) {
        audioRef.current.srcObject = audioStream;
        audioRef.current.volume = volume;
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

  // Calculate dynamic scale based on volume if speaking
  const dynamicScale = isActiveSpeaker ? 1.05 + (audioLevel * 0.15) : 1;

  return (
    <motion.div
      ref={visibilityRef}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ 
        opacity: 1, 
        scale: dynamicScale, 
        y: 0,
        zIndex: isActiveSpeaker ? 10 : 1
      }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ 
        type: "spring", 
        stiffness: 220, 
        damping: 22, 
        mass: 0.8 // smooth ~400ms duration
      }}
      className="group relative"
      layout
    >
      {/* Active speaker glow */}
      {isActiveSpeaker && <SpeakerGlow />}

      <Card
        className={cn(
          "bg-white/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60 overflow-hidden backdrop-blur-md transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700/80 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-black/20 relative",
          isLocal && "ring-1 ring-violet-200 dark:ring-zinc-700/40 bg-white/95 dark:bg-zinc-900/70",
          isActiveSpeaker && "ring-2 ring-violet-500/40 dark:ring-violet-400/30 border-violet-400/50 dark:border-violet-500/30 shadow-lg shadow-violet-500/10",
          speaking && !isActiveSpeaker && "ring-2 ring-emerald-500/30 border-emerald-500/30 dark:border-emerald-800/30"
        )}
      >
        <CardContent className={cn(
          "flex flex-col items-center gap-4",
          hasCameraVideo ? "p-0" : "p-5"
        )}>
          {/* Camera Video Feed */}
          {hasCameraVideo ? (
            <div className="w-full aspect-video bg-zinc-950 relative overflow-hidden">
              <video
                ref={cameraVideoRef}
                autoPlay
                muted={isLocal}
                playsInline
                className={cn(
                  "w-full h-full object-cover",
                  isLocal && "transform -scale-x-100" // Mirror local camera
                )}
              />
              {/* Overlay info on video */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white drop-shadow-md">
                      {name} {isLocal && <span className="text-white/60 font-normal">(You)</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {muted && (
                      <Badge variant="outline" className="text-[9px] border-red-500/50 text-red-300 bg-red-950/40 px-1.5 py-0">
                        MUTED
                      </Badge>
                    )}
                    {speaking && (
                      <div className="flex items-center gap-1">
                        <div className="flex gap-[2px] items-end h-3">
                          {[0, 1, 2].map(i => (
                            <motion.div
                              key={i}
                              animate={{ height: [3, 8 + Math.random() * 4, 3] }}
                              transition={{ duration: 0.4 + i * 0.1, repeat: Infinity, ease: "easeInOut" }}
                              className="w-[2px] bg-emerald-400 rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Focus button (visible on hover) */}
              {onClickFocus && !isFocusTarget && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClickFocus(); }}
                  className="absolute top-2 left-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-white/80 hover:text-white z-10"
                  title="Focus on this speaker"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              )}
              {/* Host Controls */}
              {localUserRole === "host" && !isLocal && (
                <div className="absolute top-2 right-6 p-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isMutedByHost ? "unmute" : "mute"); }}
                    className={cn(
                      "p-1.5 rounded-lg text-white",
                      peer.isMutedByHost ? "bg-emerald-500/80 hover:bg-emerald-500" : "bg-red-500/80 hover:bg-red-500"
                    )}
                    title={peer.isMutedByHost ? "Unmute Audio" : "Force Mute Audio"}
                  >
                    {peer.isMutedByHost ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isVideoDisabledByHost ? "enableVideo" : "disableVideo"); }}
                    className={cn(
                      "p-1.5 rounded-lg text-white",
                      peer.isVideoDisabledByHost ? "bg-emerald-500/80 hover:bg-emerald-500" : "bg-red-500/80 hover:bg-red-500"
                    )}
                    title={peer.isVideoDisabledByHost ? "Enable Video" : "Force Disable Video"}
                  >
                    {peer.isVideoDisabledByHost ? <Eye className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
              {/* Connection dot */}
              <div className="absolute top-2 right-2 z-10">
                <div className={cn(
                  "h-2.5 w-2.5 rounded-full shadow-md",
                  (isLocal || peer.connectionState === "connected" || peer.connectionState === "completed")
                    ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                )} />
              </div>
            </div>
          ) : (
            <>
              {/* Avatar with audio ring (no camera) */}
              <div className="relative">
                <div className="relative">
                  <Avatar className={cn(
                    "h-20 w-20 border-2 transition-colors duration-300",
                    isLocal ? "border-violet-200 dark:border-zinc-600" : "border-zinc-200 dark:border-zinc-800",
                    speaking && "border-emerald-400 dark:border-emerald-600/50",
                    isActiveSpeaker && "border-violet-400 dark:border-violet-500/60"
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
                  {videoOn && !hasCameraVideo && (
                    <Badge variant="outline" className="text-[10px] border-violet-900/40 text-violet-400 bg-violet-950/20 px-1.5">
                      <Video className="h-2.5 w-2.5 mr-1" /> VIDEO
                    </Badge>
                  )}
                  {speaking && (
                    <div className="flex items-center gap-1">
                      <div className="flex gap-[2px] items-end h-3">
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            animate={{ height: [3, 8 + Math.random() * 4, 3] }}
                            transition={{ duration: 0.4 + i * 0.1, repeat: Infinity, ease: "easeInOut" }}
                            className="w-[2px] bg-emerald-400 rounded-full"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {!muted && !sharing && !videoOn && !speaking && (
                    <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
                      {isLocal ? "Broadcasting" : "Connected"}
                    </p>
                  )}
                </div>
                
                {/* Host Controls */}
                {localUserRole === "host" && !isLocal && (
                  <div className="flex items-center justify-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isMutedByHost ? "unmute" : "mute"); }}
                      className={cn(
                        "p-1 px-2 border text-xs rounded-md flex items-center gap-1",
                        peer.isMutedByHost
                          ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500"
                          : "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500"
                      )}
                      title={peer.isMutedByHost ? "Unmute Audio" : "Force Mute Audio"}
                    >
                      {peer.isMutedByHost ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                      {peer.isMutedByHost ? "Unmute" : "Mute"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isVideoDisabledByHost ? "enableVideo" : "disableVideo"); }}
                      className={cn(
                        "p-1 px-2 border text-xs rounded-md flex items-center gap-1",
                        peer.isVideoDisabledByHost
                          ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500"
                          : "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500"
                      )}
                      title={peer.isVideoDisabledByHost ? "Enable Video" : "Force Disable Video"}
                    >
                      {peer.isVideoDisabledByHost ? <Eye className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                      {peer.isVideoDisabledByHost ? "Show" : "Hide"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Screen share thumbnail (when also has camera) */}
          {hasScreenVideo && hasCameraVideo && (
            <div className="w-full px-3 pb-3">
              <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800/50 shadow-inner">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  muted={isLocal}
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Screen share (when no camera - full view in card) */}
          {hasScreenVideo && !hasCameraVideo && (
            <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800/50 shadow-inner">
              <video
                ref={screenVideoRef}
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
