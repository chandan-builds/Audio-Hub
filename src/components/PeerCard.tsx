import React, { useRef, useEffect, memo, useMemo } from "react";
import type { Key } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Video, Maximize2, MicOff, Mic, VideoOff, Eye, Monitor } from "lucide-react";
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

/* ─── Avatar color hashing ─────────────────────────────────────────────────── */

const AVATAR_GRADIENTS = [
  "from-violet-600 to-indigo-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-pink-600",
  "from-rose-500 to-red-600",
  "from-fuchsia-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-cyan-600",
];

function nameToGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

/* ─── Sub-components ───────────────────────────────────────────────────────── */

function ConnectionDot({ state }: { state: RTCIceConnectionState | "local" }) {
  const isGood = state === "local" || state === "connected" || state === "completed";
  const isWarning = state === "checking" || state === "new";

  return (
    <div className={cn(
      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ah-bg z-10",
      isGood ? "bg-emerald-400" : isWarning ? "bg-amber-400" : "bg-red-400"
    )}>
      {isGood && (
        <motion.div
          animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-emerald-400"
        />
      )}
    </div>
  );
}

/** Pulsing audio ring for speaking user in avatar mode */
function AudioRing({ level }: { level: number }) {
  if (level < 0.05) return null;
  return (
    <>
      <motion.div
        animate={{ scale: 1 + level * 0.35, opacity: 0.15 + level * 0.4 }}
        transition={{ duration: 0.08 }}
        className="absolute inset-0 rounded-full border-2 border-emerald-400/50 pointer-events-none"
      />
      {level > 0.2 && (
        <motion.div
          animate={{ scale: 1 + level * 0.6, opacity: level * 0.25 }}
          transition={{ duration: 0.08 }}
          className="absolute inset-0 rounded-full border border-emerald-400/25 pointer-events-none"
        />
      )}
    </>
  );
}

/** Full-card speaking glow aura */
function SpeakerAura() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.25, 0.55, 0.25] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -inset-[3px] rounded-[calc(var(--ah-card-radius)+3px)] pointer-events-none z-0"
      style={{
        background: "linear-gradient(135deg, oklch(0.65 0.22 285 / 30%), oklch(0.70 0.18 160 / 20%), oklch(0.65 0.22 285 / 30%))",
        filter: "blur(4px)",
      }}
    />
  );
}

/** Animated bars for speaking indicator */
function SpeakingBars() {
  return (
    <div className="flex gap-[2px] items-end h-3.5" aria-label="Speaking">
      {[0.6, 1, 0.75].map((height, i) => (
        <motion.div
          key={i}
          animate={{ scaleY: [height, 0.3, height] }}
          transition={{ duration: 0.35 + i * 0.12, repeat: Infinity, ease: "easeInOut" }}
          className="w-[2.5px] rounded-full origin-bottom"
          style={{
            height: `${height * 14}px`,
            background: "linear-gradient(to top, oklch(0.70 0.18 160), oklch(0.85 0.15 160))",
          }}
        />
      ))}
    </div>
  );
}

/** Small status pill for mute/screen labels */
function StatusPill({
  children,
  color = "default",
}: {
  children: React.ReactNode;
  color?: "red" | "cyan" | "violet" | "default";
}) {
  const colorMap = {
    red: "bg-red-950/60 border-red-500/40 text-red-300",
    cyan: "bg-cyan-950/60 border-cyan-500/40 text-cyan-300",
    violet: "bg-violet-950/60 border-violet-500/40 text-violet-300",
    default: "bg-black/50 border-white/10 text-white/70",
  };
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border backdrop-blur-md",
      colorMap[color]
    )}>
      {children}
    </span>
  );
}

/* ─── Main PeerCard ────────────────────────────────────────────────────────── */

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

  // ── Derive values ─────────────────────────────────────────────────────────
  const name = isLocal ? localUserName || "You" : peer.userName;
  const audioStream = isLocal ? localStream : peer.stream;
  const muted = isLocal ? isMuted : peer.isMuted;
  const sharing = isLocal ? isSharingScreen : peer.isSharingScreen;
  const videoOn = isLocal ? isVideoEnabled : peer.isVideoEnabled;
  const audioLevel = isLocal ? 0 : peer.audioLevel;
  const speaking = isLocal ? false : peer.isSpeaking;

  const gradient = useMemo(() => nameToGradient(name), [name]);

  /**
   * SINGLE source of truth for all video rendering.
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
      el.play().catch(() => {
        const resume = () => { el?.play().catch(() => {}); document.removeEventListener("click", resume); };
        document.addEventListener("click", resume);
      });
    }
  }, [audioStream, isLocal, volume]);

  useEffect(() => {
    if (audioRef.current && !isLocal) audioRef.current.volume = volume;
  }, [volume, isLocal]);

  // ── Dynamic scale for active speaker ─────────────────────────────────────
  const dynamicScale = isActiveSpeaker ? 1 + audioLevel * 0.04 : 1;

  return (
    <motion.div
      ref={visibilityRef}
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: dynamicScale, y: 0, zIndex: isActiveSpeaker ? 10 : 1 }}
      exit={{ opacity: 0, scale: 0.88, y: -8 }}
      transition={{ type: "spring", stiffness: 240, damping: 24, mass: 0.7 }}
      className="group relative"
      layout
    >
      {/* Speaker aura (outside the card) */}
      <AnimatePresence>
        {(isActiveSpeaker || speaking) && <SpeakerAura key="aura" />}
      </AnimatePresence>

      {/* Glass card surface */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[var(--ah-card-radius)] z-[1]",
          "bg-ah-surface/60 backdrop-blur-xl border transition-all duration-300",
          "shadow-lg shadow-black/20",
          // Border states
          isLocal
            ? "border-ah-accent/30"
            : isActiveSpeaker
            ? "border-emerald-400/60 shadow-emerald-500/10"
            : speaking
            ? "border-emerald-400/35"
            : "border-ah-glass-border hover:border-ah-border-strong",
          // Card hover lift
          "hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5",
        )}
      >
        {hasPrimary ? (
          /* ── Video Tile ─────────────────────────────────────────────────── */
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

            {/* Gradient vignette for readability */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.25)_100%)]" />

            {/* PiP overlay */}
            {hasPip && secondaryStream && (
              <DraggablePip
                stream={secondaryStream}
                muted={isLocal ?? false}
                boundsRef={videoBoundsRef}
                storageKey={`audio-hub-pip-card-${isLocal ? "local" : peer.userId}`}
                className="w-24 sm:w-28"
              />
            )}

            {/* Speaking pulse border overlay */}
            <AnimatePresence>
              {(isActiveSpeaker || speaking) && (
                <motion.div
                  key="speaking-border"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-[var(--ah-card-radius)] pointer-events-none ring-2 ring-emerald-400/60"
                />
              )}
            </AnimatePresence>

            {/* Status pills — top left */}
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
              {primarySource === "screen" && (
                <StatusPill color="cyan">
                  <Monitor className="h-2.5 w-2.5" />
                  Screen
                </StatusPill>
              )}
              {isFocusTarget && (
                <StatusPill color="violet">Focused</StatusPill>
              )}
            </div>

            {/* Host controls — top right, reveal on hover */}
            {localUserRole === "host" && !isLocal && (
              <div className="absolute top-2.5 right-9 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isMutedByHost ? "unmute" : "mute"); }}
                  className={cn(
                    "p-1.5 rounded-lg backdrop-blur-md border text-white transition-all duration-150",
                    peer.isMutedByHost
                      ? "bg-emerald-500/70 border-emerald-400/50 hover:bg-emerald-500"
                      : "bg-red-500/70 border-red-400/50 hover:bg-red-500"
                  )}
                  title={peer.isMutedByHost ? "Unmute Audio" : "Force Mute"}
                >
                  {peer.isMutedByHost ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isVideoDisabledByHost ? "enableVideo" : "disableVideo"); }}
                  className={cn(
                    "p-1.5 rounded-lg backdrop-blur-md border text-white transition-all duration-150",
                    peer.isVideoDisabledByHost
                      ? "bg-emerald-500/70 border-emerald-400/50 hover:bg-emerald-500"
                      : "bg-red-500/70 border-red-400/50 hover:bg-red-500"
                  )}
                  title={peer.isVideoDisabledByHost ? "Enable Video" : "Force Disable Video"}
                >
                  {peer.isVideoDisabledByHost ? <Eye className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                </button>
              </div>
            )}

            {/* Connection dot — top right */}
            <div className="absolute top-2.5 right-2.5 z-10">
              <div className={cn(
                "h-2.5 w-2.5 rounded-full shadow-lg",
                (isLocal || peer.connectionState === "connected" || peer.connectionState === "completed")
                  ? "bg-emerald-400 shadow-emerald-400/60"
                  : "bg-amber-400 shadow-amber-400/60 animate-pulse"
              )} />
            </div>

            {/* Name + status bar — bottom gradient */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 py-3 z-10">
              <div className="flex items-end justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-[13px] font-semibold text-white drop-shadow truncate">
                    {name}
                    {isLocal && <span className="text-white/50 font-normal ml-1">(You)</span>}
                  </p>
                  {speaking && <SpeakingBars />}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {muted && (
                    <div className="p-1 bg-red-500/80 rounded-md backdrop-blur-sm">
                      <MicOff className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Focus button — appears on hover */}
            {onClickFocus && !isFocusTarget && (
              <button
                onClick={(e) => { e.stopPropagation(); onClickFocus(); }}
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-20"
                title="Focus on this speaker"
              >
                <div className="bg-black/50 backdrop-blur-md border border-white/20 rounded-xl px-3 py-2 flex items-center gap-2 text-white text-xs font-medium shadow-xl">
                  <Maximize2 className="h-3.5 w-3.5" />
                  Focus
                </div>
              </button>
            )}
          </div>
        ) : (
          /* ── Avatar tile ────────────────────────────────────────────────── */
          <div className="flex flex-col items-center gap-3 p-6">
            {/* Gradient avatar with audio ring */}
            <div className="relative">
              <div className="relative">
                <Avatar className="h-20 w-20 shadow-xl">
                  <AvatarFallback className={cn(
                    "text-xl font-bold text-white bg-gradient-to-br",
                    gradient
                  )}>
                    {name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <AudioRing level={audioLevel} />
                <ConnectionDot state={isLocal ? "local" : peer.connectionState} />
              </div>
            </div>

            {/* Name + status */}
            <div className="text-center space-y-1.5">
              <p className="font-semibold text-ah-text text-[14px]">
                {name}
                {isLocal && <span className="text-ah-text-muted font-normal ml-1">(You)</span>}
              </p>

              <div className="flex items-center justify-center flex-wrap gap-1.5">
                {muted && (
                  <StatusPill color="red">
                    <MicOff className="h-2.5 w-2.5" />
                    Muted
                  </StatusPill>
                )}
                {sharing && (
                  <StatusPill color="cyan">
                    <Monitor className="h-2.5 w-2.5" />
                    Sharing
                  </StatusPill>
                )}
                {videoOn && !hasPrimary && (
                  <StatusPill color="violet">
                    <Video className="h-2.5 w-2.5" />
                    Video
                  </StatusPill>
                )}
                {speaking && <SpeakingBars />}
                {!muted && !sharing && !videoOn && !speaking && (
                  <p className="text-[10px] text-ah-text-faint font-mono uppercase tracking-wider">
                    {isLocal ? "Broadcasting" : "Connected"}
                  </p>
                )}
              </div>

              {/* Host controls (avatar mode) */}
              {localUserRole === "host" && !isLocal && (
                <div className="flex items-center justify-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isMutedByHost ? "unmute" : "mute"); }}
                    className={cn(
                      "px-2 py-1 border text-[11px] rounded-lg flex items-center gap-1 font-medium transition-colors",
                      peer.isMutedByHost
                        ? "border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400"
                        : "border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-400"
                    )}
                  >
                    {peer.isMutedByHost ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                    {peer.isMutedByHost ? "Unmute" : "Mute"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onHostAction?.(peer.userId, peer.isVideoDisabledByHost ? "enableVideo" : "disableVideo"); }}
                    className={cn(
                      "px-2 py-1 border text-[11px] rounded-lg flex items-center gap-1 font-medium transition-colors",
                      peer.isVideoDisabledByHost
                        ? "border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400"
                        : "border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-400"
                    )}
                  >
                    {peer.isVideoDisabledByHost ? <Eye className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                    {peer.isVideoDisabledByHost ? "Show" : "Hide"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio element for remote peers */}
        {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
      </div>
    </motion.div>
  );
});
