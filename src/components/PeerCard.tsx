import { useRef, useEffect, memo } from "react";
import type { Key } from "react";
import { motion } from "motion/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, Maximize2, MicOff, Mic, VideoOff, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PeerData, MediaPresentation } from "@/src/hooks/webrtc/types";
import { useVisibilityPause } from "@/src/hooks/useVisibilityPause";
import { DraggablePip } from "./DraggablePip";

interface PeerCardProps {
  key?: Key;
  peer: PeerData;
  isLocal?: boolean;
  localUserName?: string;
  isMuted?: boolean;
  isSharingScreen?: boolean;
  isVideoEnabled?: boolean;
  localStream?: MediaStream | null;
  /** Pre-computed presentation for the local user. Required when isLocal=true. */
  localPresentation?: MediaPresentation;
  volume?: number;
  isActiveSpeaker?: boolean;
  onClickFocus?: () => void;
  isFocusTarget?: boolean;
  localUserRole?: "host" | "participant" | "unknown";
  onHostAction?: (targetUserId: string, action: "mute" | "unmute" | "disableVideo" | "enableVideo") => void;
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function ConnectionDot({ state }: { state: RTCIceConnectionState | "local" }) {
  const color =
    state === "local" || state === "connected" || state === "completed"
      ? "bg-emerald-400 shadow-emerald-400/40"
      : state === "checking" || state === "new"
      ? "bg-amber-400 shadow-amber-400/40"
      : "bg-red-400 shadow-red-400/40";

  return (
    <div className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ah-bg shadow-md", color)}>
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

/** Speaking visualizer bars */
function SpeakingBars() {
  return (
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
  );
}

/* ─── PiP Overlay — rendered when presentation has a secondaryStream ──────── */
/* ─── Main PeerCard ───────────────────────────────────────────────────────── */

export const PeerCard = memo(function PeerCard({
  peer,
  isLocal,
  localUserName,
  isMuted,
  isSharingScreen,
  isVideoEnabled,
  localStream,
  localPresentation,
  volume = 1.0,
  isActiveSpeaker = false,
  onClickFocus,
  isFocusTarget = false,
  localUserRole,
  onHostAction,
}: PeerCardProps) {
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoBoundsRef = useRef<HTMLDivElement>(null);

  // ── Derive values from the correct source of truth ───────────────────────
  const name = isLocal ? localUserName || "You" : peer.userName;
  const audioStream = isLocal ? localStream : peer.stream;
  const muted = isLocal ? isMuted : peer.isMuted;
  const sharing = isLocal ? isSharingScreen : peer.isSharingScreen;
  const videoOn = isLocal ? isVideoEnabled : peer.isVideoEnabled;
  const audioLevel = isLocal ? 0 : peer.audioLevel;
  const speaking = isLocal ? false : peer.isSpeaking;

  /**
   * SINGLE source of truth for all video rendering.
   * - Local user: must supply localPresentation (computed via computePresentation in memory).
   * - Remote user: always use peer.presentation (written by useSignalingAgent).
   * We never inspect cameraStream/screenStream directly here.
   */
  const presentation: MediaPresentation = isLocal
    ? (localPresentation ?? { primaryStream: null, secondaryStream: null, primarySource: "none" })
    : peer.presentation;

  const { primaryStream, secondaryStream, primarySource } = presentation;
  const hasPrimary = !!primaryStream;
  const hasPip = !!secondaryStream;

  // Pause off-screen primary video track (visibility optimization)
  const { containerRef: visibilityRef } = useVisibilityPause(
    !isLocal ? primaryStream ?? undefined : undefined
  );

  // ── Bind primary video ────────────────────────────────────────────────────
  useEffect(() => {
    const el = primaryVideoRef.current;
    if (!el) return;
    if (primaryStream) {
      if (el.srcObject !== primaryStream) {
        el.srcObject = primaryStream;
      }
    } else {
      el.srcObject = null;
    }
  }, [primaryStream]);

  // ── Bind + play audio ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el || isLocal || !audioStream) return;
    if (el.srcObject !== audioStream) {
      el.srcObject = audioStream;
      el.volume = volume;
      el.play().catch((err) => {
        console.warn("[Audio] Autoplay blocked, will retry on user interaction:", err);
        const resume = () => {
          el?.play().catch(() => {});
          document.removeEventListener("click", resume);
          document.removeEventListener("keydown", resume);
        };
        document.addEventListener("click", resume);
        document.addEventListener("keydown", resume);
      });
    }
  }, [audioStream, isLocal, volume]);

  useEffect(() => {
    if (audioRef.current && !isLocal) {
      audioRef.current.volume = volume;
    }
  }, [volume, isLocal]);

  // ── Dynamic scale for active speaker ─────────────────────────────────────
  const dynamicScale = isActiveSpeaker ? 1.05 + audioLevel * 0.15 : 1;

  return (
    <motion.div
      ref={visibilityRef}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{
        opacity: 1,
        scale: dynamicScale,
        y: 0,
        zIndex: isActiveSpeaker ? 10 : 1,
      }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ type: "spring", stiffness: 220, damping: 22, mass: 0.8 }}
      className="group relative"
      layout
    >
      {/* Active speaker glow */}
      {isActiveSpeaker && <SpeakerGlow />}

      <Card
        className={cn(
          "relative overflow-hidden border border-ah-border bg-ah-surface shadow-sm transition-all duration-300",
          "hover:border-ah-border-strong hover:shadow-lg hover:shadow-black/10",
          isLocal && "ring-1 ring-[color:var(--ah-focus-ring)]",
          isActiveSpeaker && "ring-2 ring-[color:var(--ah-focus-ring-strong)] border-[color:var(--ah-focus-ring-strong)] shadow-lg shadow-violet-500/10",
          speaking && !isActiveSpeaker && "ring-2 ring-[color:var(--ah-speaking-ring)] border-[color:var(--ah-speaking-ring)]"
        )}
      >
        <CardContent className={cn("flex flex-col items-center gap-4", hasPrimary ? "p-0" : "p-5")}>

          {/* ── Primary Video Tile ──────────────────────────────────────── */}
          {hasPrimary ? (
            <div ref={videoBoundsRef} className="relative aspect-video w-full overflow-hidden bg-[#050505]">
              <video
                ref={primaryVideoRef}
                autoPlay
                muted={isLocal}
                playsInline
                className={cn(
                  "w-full h-full",
                  primarySource === "screen" ? "object-contain" : "object-cover",
                  isLocal && primarySource === "camera" && "transform -scale-x-100"
                )}
              />

              {/* PiP overlay: camera-in-screen or screen-in-camera  */}
              {hasPip && secondaryStream && (
                <DraggablePip
                  stream={secondaryStream}
                  muted={isLocal ?? false}
                  boundsRef={videoBoundsRef}
                  storageKey={`audio-hub-pip-card-${isLocal ? "local" : peer.userId}`}
                  className="w-24 sm:w-28"
                />
              )}

              {/* Screen-share source indicator */}
              {primarySource === "screen" && (
                <div className="absolute top-2 left-2 z-10">
                  <Badge variant="outline" className="text-[9px] border-cyan-500/40 text-cyan-300 bg-cyan-950/40 px-1.5 py-0">
                    SCREEN
                  </Badge>
                </div>
              )}

              {/* Overlay: name + status ─────────────────────────────── */}
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
                    {speaking && <SpeakingBars />}
                  </div>
                </div>
              </div>

              {/* Focus button */}
              {onClickFocus && !isFocusTarget && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClickFocus(); }}
                  className="absolute top-2 left-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-white/80 hover:text-white z-10"
                  title="Focus on this speaker"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Host controls (on video) */}
              {localUserRole === "host" && !isLocal && (
                <div className="absolute top-2 right-6 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isMutedByHost ? "unmute" : "mute"); }}
                    className={cn("p-1.5 rounded-lg text-white", peer.isMutedByHost ? "bg-emerald-500/80 hover:bg-emerald-500" : "bg-red-500/80 hover:bg-red-500")}
                    title={peer.isMutedByHost ? "Unmute Audio" : "Force Mute Audio"}
                  >
                    {peer.isMutedByHost ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isVideoDisabledByHost ? "enableVideo" : "disableVideo"); }}
                    className={cn("p-1.5 rounded-lg text-white", peer.isVideoDisabledByHost ? "bg-emerald-500/80 hover:bg-emerald-500" : "bg-red-500/80 hover:bg-red-500")}
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
            /* ── Avatar tile (no primary video) ─────────────────────── */
            <>
              <div className="relative">
                <div className="relative">
                  <Avatar className={cn(
                    "h-20 w-20 border-2 transition-colors duration-300",
                    isLocal ? "border-[color:var(--ah-focus-ring)]" : "border-ah-border",
                    speaking && "border-[color:var(--ah-speaking-ring)]",
                    isActiveSpeaker && "border-[color:var(--ah-focus-ring-strong)]"
                  )}>
                    <AvatarFallback className={cn(
                      "text-xl font-bold",
                      isLocal
                        ? "bg-ah-surface-raised text-ah-text"
                        : "bg-gradient-to-br from-ah-surface to-ah-surface-raised text-ah-text-muted"
                    )}>
                      {name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <AudioRing level={audioLevel} />
                  <ConnectionDot state={isLocal ? "local" : peer.connectionState} />
                </div>
              </div>

              {/* Name, status, host controls */}
              <div className="text-center space-y-1">
                <p className="font-semibold text-ah-text">
                  {name} {isLocal && <span className="text-ah-text-muted font-normal">(You)</span>}
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
                  {videoOn && !hasPrimary && (
                    <Badge variant="outline" className="text-[10px] border-violet-900/40 text-violet-400 bg-violet-950/20 px-1.5">
                      <Video className="h-2.5 w-2.5 mr-1" /> VIDEO
                    </Badge>
                  )}
                  {speaking && <SpeakingBars />}
                  {!muted && !sharing && !videoOn && !speaking && (
                    <p className="text-[10px] text-ah-text-muted font-mono uppercase tracking-wider">
                      {isLocal ? "Broadcasting" : "Connected"}
                    </p>
                  )}
                </div>

                {/* Host controls (avatar mode) */}
                {localUserRole === "host" && !isLocal && (
                  <div className="flex items-center justify-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isMutedByHost ? "unmute" : "mute"); }}
                      className={cn("p-1 px-2 border text-xs rounded-md flex items-center gap-1",
                        peer.isMutedByHost
                          ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500"
                          : "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500"
                      )}
                    >
                      {peer.isMutedByHost ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                      {peer.isMutedByHost ? "Unmute" : "Mute"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isVideoDisabledByHost ? "enableVideo" : "disableVideo"); }}
                      className={cn("p-1 px-2 border text-xs rounded-md flex items-center gap-1",
                        peer.isVideoDisabledByHost
                          ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500"
                          : "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500"
                      )}
                    >
                      {peer.isVideoDisabledByHost ? <Eye className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                      {peer.isVideoDisabledByHost ? "Show" : "Hide"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Audio element for remote peers */}
          {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
        </CardContent>
      </Card>
    </motion.div>
  );
});
