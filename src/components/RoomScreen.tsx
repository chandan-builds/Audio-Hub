import { AnimatePresence, motion } from "motion/react";
import type { JoinPreferences } from "./prejoin/PreJoinScreen";
import {
  Radio, Copy, Check, Users, MessageSquare, Maximize2, Minimize2, ZoomIn, ZoomOut, MousePointer2,
  Signal, SignalHigh, SignalMedium, SignalLow, X
} from "lucide-react";
import React, { useState, useRef, useEffect, memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./ThemeToggle";
import { PeerCard } from "./PeerCard";
import { ControlBar } from "./ControlBar";
import { ActivitySidebar } from "./ActivitySidebar";
import { ChatPanel } from "./ChatPanel";
import { DeviceSelector } from "./DeviceSelector";
import { SettingsModal } from "./room/SettingsModal";
import { useWebRTCMemory, useWebRTCCoordinator } from "@/src/hooks/useWebRTC";
import { useRecordingAgent } from "@/src/hooks/useRecordingAgent";
import { cn } from "@/lib/utils";
// Phase 4 — Stability & Resilience
import { useConnectionMonitor } from "@/src/hooks/useConnectionMonitor";
import { useKeyboardShortcuts, usePushToTalk, useShortcutHelpModal } from "@/src/hooks/useKeyboardShortcuts";
import { ReconnectionOverlay } from "./room/ReconnectionOverlay";
import { PermissionOverlay } from "./room/PermissionOverlay";
import type { PermissionError } from "./room/PermissionOverlay";
import { ShortcutHelpModal } from "./room/ShortcutHelpModal";

/* ───────────────────────────────────────────────────
   Screen Share Focus — full-screen with zoom/pan
   ─────────────────────────────────────────────────── */
const ScreenShareFocus = memo(function ScreenShareFocus({ stream, userName }: { stream: MediaStream, userName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [stream]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) { setScale(1); setPosition({ x: 0, y: 0 }); }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) await containerRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) { console.warn("Fullscreen toggle failed", err); }
  };

  const showControls = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isDragging.current && !document.querySelector('.zoom-controls:hover')) setControlsVisible(false);
    }, 2500);
  };

  const resetZoom = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isFullscreen) return;
    e.preventDefault();
    setScale((prev) => Math.min(Math.max(1, prev - e.deltaY * 0.005), 5));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= 1 || !isFullscreen) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    showControls();
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={showControls}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={toggleFullscreen}
      className={cn(
        "bg-zinc-100 dark:bg-black overflow-hidden relative group select-none touch-none",
        isFullscreen ? "w-screen h-screen m-0 rounded-none border-0" : "mb-6 w-full aspect-video md:h-[60vh] rounded-2xl border border-zinc-200 dark:border-zinc-800/50 shadow-2xl shadow-black/5 dark:shadow-black/50"
      )}
    >
      <div 
        className="w-full h-full flex items-center justify-center transform-gpu"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging.current ? "none" : "transform 0.15s ease-out",
          cursor: scale > 1 ? (isDragging.current ? "grabbing" : "grab") : "default"
        }}
      >
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain pointer-events-none" />
      </div>
      
      <AnimatePresence>
        {(controlsVisible || !isFullscreen) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
            <div className="absolute top-4 left-4">
              <Badge className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-200 shadow-lg pointer-events-auto">
                {userName}'s screen
              </Badge>
            </div>
            <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto zoom-controls">
              {isFullscreen && (
                <>
                  <div className="flex items-center gap-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/50 p-1.5 rounded-lg shadow-lg">
                    <button onClick={resetZoom} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-600 dark:text-zinc-300" title="Reset Zoom"><ZoomOut className="h-4 w-4" /></button>
                    <span className="text-[10px] font-mono font-bold w-10 text-center text-zinc-800 dark:text-zinc-200">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(5, s + 0.5))} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-600 dark:text-zinc-300" title="Zoom In"><ZoomIn className="h-4 w-4" /></button>
                  </div>
                  {scale > 1 && (
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/50 h-8 px-3 rounded-lg shadow-lg flex items-center gap-2">
                       <MousePointer2 className="h-3.5 w-3.5 text-violet-500" />
                       <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">Drag to pan</span>
                    </div>
                  )}
                </>
              )}
              <button 
                onClick={toggleFullscreen}
                className="bg-white/80 hover:bg-white dark:bg-zinc-900/80 dark:hover:bg-zinc-900 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/50 p-2 rounded-lg shadow-lg text-zinc-700 dark:text-zinc-200 transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen (Double-click)"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});


/* ───────────────────────────────────────────────────
   Active Speaker Focus — large main view + side strip
   ─────────────────────────────────────────────────── */
const SpeakerFocusView = memo(function SpeakerFocusView({
  focusPeer,
  focusPeerId,
  isLocal,
  localUserName,
  localStream,
  localPresentation,
  isMuted,
  volume,
  onClose,
}: {
  focusPeer: import("@/src/hooks/useWebRTC").PeerData;
  focusPeerId: string;
  isLocal: boolean;
  localUserName?: string;
  localStream?: MediaStream | null;
  /** Pre-computed presentation for local user — required when isLocal=true. */
  localPresentation?: import("@/src/hooks/webrtc/types").MediaPresentation | null;
  isMuted?: boolean;
  volume: number;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const name = isLocal ? localUserName || "You" : focusPeer.userName;
  const audioStream = isLocal ? localStream : focusPeer.stream;
  const muted = isLocal ? isMuted : focusPeer.isMuted;
  const speaking = isLocal ? false : focusPeer.isSpeaking;

  /**
   * Presentation-driven: consume the single source-of-truth for what to show.
   * Local user passes localPresentation; remote user uses peer.presentation.
   */
  const presentation = isLocal
    ? (localPresentation ?? { primaryStream: null, secondaryStream: null, primarySource: "none" as const })
    : focusPeer.presentation;

  const { primaryStream, secondaryStream, primarySource } = presentation;
  const hasPrimary = !!primaryStream;

  // Bind primary video
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (primaryStream) {
      if (el.srcObject !== primaryStream) el.srcObject = primaryStream;
    } else {
      el.srcObject = null;
    }
  }, [primaryStream]);

  // Bind PiP (secondary)
  const pipRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = pipRef.current;
    if (!el) return;
    if (secondaryStream) {
      if (el.srcObject !== secondaryStream) el.srcObject = secondaryStream;
    } else {
      el.srcObject = null;
    }
  }, [secondaryStream]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || isLocal || !audioStream) return;
    if (el.srcObject !== audioStream) {
      el.srcObject = audioStream;
      el.volume = volume;
      el.play().catch(() => {});
    }
  }, [audioStream, isLocal, volume]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="mb-6 w-full rounded-2xl overflow-hidden bg-zinc-950 border border-ah-border shadow-2xl shadow-black/30 relative group"
    >
      {/* Large video view */}
      <div className="w-full aspect-video md:h-[55vh] relative bg-zinc-950 flex items-center justify-center">
        {hasPrimary ? (
          <video
            ref={videoRef}
            autoPlay
            muted={isLocal}
            playsInline
            className={cn(
              "w-full h-full",
              primarySource === "screen" ? "object-contain" : "object-cover",
              isLocal && primarySource === "camera" && "transform -scale-x-100"
            )}
          />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-28 w-28 border-4 border-zinc-700">
              <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-200 text-4xl font-bold">
                {name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="text-zinc-300 text-lg font-semibold">{name}</p>
          </div>
        )}

        {/* PiP in focus view (e.g. camera-in-screen) */}
        {secondaryStream && (
          <div className="absolute bottom-3 right-3 w-36 aspect-video rounded-xl overflow-hidden border border-white/20 shadow-xl bg-black z-10">
            <video
              ref={pipRef}
              autoPlay
              muted={isLocal}
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Screen source badge */}
        {primarySource === "screen" && (
          <div className="absolute top-3 left-3 z-10">
            <Badge variant="outline" className="text-[9px] border-cyan-500/40 text-cyan-300 bg-cyan-950/40 px-1.5">
              SCREEN
            </Badge>
          </div>
        )}

        {/* Overlay HUD */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-base font-semibold text-white drop-shadow-lg">
                {name} {isLocal && <span className="text-white/50 font-normal">(You)</span>}
              </p>
              {speaking && (
                <div className="flex gap-[2px] items-end h-4">
                  {[0, 1, 2, 3].map(i => (
                    <motion.div
                      key={i}
                      animate={{ height: [4, 12 + Math.random() * 6, 4] }}
                      transition={{ duration: 0.4 + i * 0.08, repeat: Infinity, ease: "easeInOut" }}
                      className="w-[3px] bg-emerald-400 rounded-full"
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {muted && (
                <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-300 bg-red-950/40 px-2 py-0.5">
                  MUTED
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-300 bg-violet-950/30 px-2 py-0.5">
                FOCUS
              </Badge>
            </div>
          </div>
        </div>

        {/* Close/exit focus button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 rounded-xl text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100"
          title="Exit Focus Mode"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
    </motion.div>
  );
});


/* ───────────────────────────────────────────────────
   Video Quality Badge
   ─────────────────────────────────────────────────── */
function VideoQualityBadge({ quality }: { quality: string }) {
  const config = {
    high: { icon: Signal, label: "HD", color: "text-emerald-500 border-emerald-900/40 bg-emerald-950/20" },
    medium: { icon: SignalHigh, label: "SD", color: "text-amber-500 border-amber-900/40 bg-amber-950/20" },
    low: { icon: SignalMedium, label: "LD", color: "text-red-500 border-red-900/40 bg-red-950/20" },
    off: { icon: SignalLow, label: "OFF", color: "text-ah-text-muted border-ah-border bg-ah-surface" },
  }[quality] || { icon: Signal, label: "?", color: "text-ah-text-muted border-ah-border bg-ah-surface" };

  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("text-[9px] font-mono gap-1 px-1.5", config.color)}>
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="bg-ah-surface border-ah-border text-ah-text">
        Video quality: {quality} ({quality === 'high' ? '720p' : quality === 'medium' ? '480p' : quality === 'low' ? '240p' : 'off'})
      </TooltipContent>
    </Tooltip>
  );
}


/* ───────────────────────────────────────────────────
   RoomScreen — Main Layout
   ─────────────────────────────────────────────────── */
interface RoomScreenProps {
  roomId: string;
  userName: string;
  userId: string;
  serverUrl: string;
  onLeave: () => void;
  /** Preferences captured on the pre-join screen. */
  joinPrefs?: JoinPreferences | null;
}

export function RoomScreen({
  roomId,
  userName,
  userId,
  serverUrl,
  onLeave,
  joinPrefs,
}: RoomScreenProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [deviceSelectorOpen, setDeviceSelectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [globalVolume, setGlobalVolume] = useState(1);
  const [focusedPeerId, setFocusedPeerId] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<PermissionError>(null);

  const {
    peers,
    localStream,
    localScreenStream,
    localVideoStream,
    localPresentation,
    isMuted,
    isSharingScreen,
    isVideoEnabled,
    isConnected,
    chatMessages,
    activityLog,
    roomUserCount,
    activeSpeakerId,
    videoQuality,
    userRole,
  } = useWebRTCMemory();

  const agents = useWebRTCCoordinator({
    roomId, userId, userName, serverUrl,
    startMuted:    joinPrefs?.startMuted    ?? false,
    startVideoOff: joinPrefs?.startVideoOff ?? false,
    preferredAudioInputId:  joinPrefs?.preferredAudioInputId  ?? undefined,
    preferredVideoInputId:  joinPrefs?.preferredVideoInputId  ?? undefined,
    preferredAudioOutputId: joinPrefs?.preferredAudioOutputId ?? undefined,
    onPermissionError: (errType) => setPermissionError(errType as PermissionError),
  });

  // ── Phase 4: Connection health monitoring ──────────────────────────────────
  const { health } = useConnectionMonitor({
    peers,
    isSignalingConnected: isConnected,
    onFailed: () => console.warn("[ConnectionMonitor] Connection failed — showing overlay"),
    onRecovered: () => console.info("[ConnectionMonitor] Connection recovered"),
  });

  // ── Phase 4: Keyboard shortcut definitions ─────────────────────────────────
  const shortcutDefs = useMemo(() => [
    { key: "m", label: "Toggle Mute",        action: agents.toggleMute },
    { key: "v", label: "Toggle Camera",       action: agents.toggleVideo },
    { key: "s", label: "Toggle Screen Share", action: agents.toggleScreenShare },
    { key: "c", label: "Toggle Chat",          action: () => setChatOpen(prev => !prev) },
    { key: "p", label: "Push-to-Talk (hold Space)", action: () => {} },
  ], [agents]);

  useKeyboardShortcuts(shortcutDefs);

  // Push-to-talk: hold Space to unmute temporarily
  usePushToTalk(
    () => { if (isMuted) agents.toggleMute(); },      // on press → unmute
    () => { if (!isMuted) agents.toggleMute(); },     // on release → re-mute
    isMuted   // only active when currently muted
  );

  // Shortcut cheat-sheet modal (press ?)
  const { isOpen: shortcutModalOpen, close: closeShortcutModal } = useShortcutHelpModal();

  // ── Phase 5: Local recording agent ────────────────────────────────────
  const recording = useRecordingAgent();

  const peerArray = useMemo(() => Array.from(peers.entries()), [peers]);

  // Auto-adjust video quality based on peer count
  useEffect(() => {
    const count = peerArray.length;
    if (count >= 10) agents.setVideoQuality('low');
    else if (count >= 5) agents.setVideoQuality('medium');
    else agents.setVideoQuality('high');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerArray.length]);

  // Smart Layout: Auto-focus logic
  const [lastActiveSpeakerId, setLastActiveSpeakerId] = useState<string | null>(null);

  // Keep track of the last speaker to avoid aggressively snapping back to grid
  useEffect(() => {
    if (activeSpeakerId && activeSpeakerId !== "local") {
      setLastActiveSpeakerId(activeSpeakerId);
    }
  }, [activeSpeakerId]);

  const effectiveFocusId = useMemo(() => {
    if (focusedPeerId) return focusedPeerId; // Manual focus always wins

    const remoteScreenSharer = peerArray.find(
      ([_, p]) => p.presentation.primarySource === "screen",
    );
    if (remoteScreenSharer) return remoteScreenSharer[0];
    if (localPresentation.primarySource === "screen") return "local";

    const remoteVideoPeers = peerArray.filter(([_, p]) => p.isVideoEnabled);
    const videoUsersCount = remoteVideoPeers.length + (isVideoEnabled ? 1 : 0);
    const speakingUsersCount = peerArray.filter(([_, p]) => p.isSpeaking).length;

    // 1. Focus active speaker
    if (activeSpeakerId && activeSpeakerId !== "local") {
      return activeSpeakerId;
    }

    // 2. Focus if only 1-2 video users
    if (videoUsersCount > 0 && videoUsersCount <= 2) {
      if (remoteVideoPeers.length > 0) return remoteVideoPeers[0][0];
      if (isVideoEnabled) return "local";
    }

    // 3. Fallback to last active speaker if not a crowded speaking room
    if (speakingUsersCount === 0 && lastActiveSpeakerId && peers.has(lastActiveSpeakerId) && videoUsersCount <= 4) {
      return lastActiveSpeakerId;
    }

    return null;
  }, [
    focusedPeerId,
    peerArray,
    activeSpeakerId,
    lastActiveSpeakerId,
    isVideoEnabled,
    peers,
    localPresentation.primarySource,
  ]);

  // Clear manual focus if focused peer disconnects
  useEffect(() => {
    if (focusedPeerId && focusedPeerId !== "local" && !peers.has(focusedPeerId)) {
      setFocusedPeerId(null);
    }
  }, [peers, focusedPeerId]);

  const handleCopyRoomId = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine focus view data
  const focusPeerData = effectiveFocusId === "local"
    ? {
        userId: "local",
        userName,
        stream: localStream,
        cameraStream: localVideoStream,
        screenStream: localScreenStream,
        presentation: localPresentation,
        connection: null as any,
        isMuted,
        isSharingScreen,
        isVideoEnabled,
        connectionState: "connected" as RTCIceConnectionState,
        audioLevel: 0,
        isSpeaking: false,
      }
    : effectiveFocusId ? peers.get(effectiveFocusId) : null;

  const isAnyVideoOn = isVideoEnabled || peerArray.some(([_, p]) => p.isVideoEnabled);

  return (
    <div className="flex flex-col h-[100dvh] bg-ah-bg">
      {/* Header */}
      <header className="h-14 border-b border-ah-border bg-ah-header-bg backdrop-blur-xl flex items-center justify-between px-5 z-10 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-ah-text-muted" />
            <h1 className="font-bold tracking-tight text-ah-text text-sm">Audio Hub</h1>
          </div>
          <Separator orientation="vertical" className="h-4 bg-ah-border" />
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-ah-surface border-ah-border text-ah-text-muted font-mono text-[11px]"
            >
              {roomId}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopyRoomId}
                  className="p-1 hover:bg-ah-surface-raised rounded-md transition-colors"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-ah-text-muted" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-ah-surface border-ah-border text-ah-text">
                Copy invite link
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={cn(
            "h-2 w-2 rounded-full",
            isConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
          )} />
          {/* Recording indicator in header */}
          {recording.isRecording && (
            <Badge variant="outline" className="gap-1 text-[10px] text-red-500 border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              REC
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* User avatars */}
          <div className="flex -space-x-2 mr-2">
            <Avatar className="h-7 w-7 border-2 border-ah-surface">
              <AvatarFallback className="bg-ah-surface-raised text-ah-text-muted text-[10px] font-bold">
                {userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {peerArray.slice(0, 3).map(([id, peer]) => (
              <Avatar key={id} className="h-7 w-7 border-2 border-ah-surface">
                <AvatarFallback className="bg-ah-surface text-ah-text-muted text-[10px]">
                  {peer.userName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {peerArray.length > 3 && (
              <Avatar className="h-7 w-7 border-2 border-ah-surface">
                <AvatarFallback className="bg-ah-surface text-[10px] text-ah-text-faint">
                  +{peerArray.length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          <Badge className="bg-ah-surface border-ah-border text-ah-text-muted text-[10px] font-mono gap-1">
            <Users className="h-3 w-3" />
            {roomUserCount}
          </Badge>

          {/* Video quality indicator (only when video is in use) */}
          {isAnyVideoOn && <VideoQualityBadge quality={videoQuality} />}

          <ThemeToggle isCompact />

          <Button
            variant="outline"
            size="icon"
            onClick={() => setChatOpen(!chatOpen)}
            className={cn(
              "rounded-full h-8 w-8 border-ah-border bg-ah-surface hover:bg-ah-surface-raised hidden xl:flex text-ah-text-muted",
              chatOpen && "bg-violet-100 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/40 text-violet-600 dark:text-violet-400 hover:bg-violet-200"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="destructive"
            onClick={() => { agents.disconnect(); onLeave(); }}
            size="sm"
            className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/40 hidden xl:flex h-8 text-xs font-semibold"
          >
            Leave
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* ─── Active Speaker / Video Focus Mode ─── */}
            <AnimatePresence mode="popLayout">
              {focusPeerData && effectiveFocusId && (
                <SpeakerFocusView
                  focusPeer={focusPeerData}
                  focusPeerId={effectiveFocusId}
                  isLocal={effectiveFocusId === "local"}
                  localUserName={userName}
                  localStream={localStream}
                  localPresentation={effectiveFocusId === "local" ? localPresentation : undefined}
                  isMuted={isMuted}
                  volume={globalVolume}
                  onClose={() => setFocusedPeerId(null)}
                />
              )}
            </AnimatePresence>

            {/* Participant Grid */}
            <motion.div 
              layout
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className={cn(
              "grid gap-4",
              effectiveFocusId
                ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}>
              {/* Local user */}
              {effectiveFocusId !== "local" && (
                <PeerCard
                  peer={{
                    userId: "local",
                    userName,
                    stream: localStream,
                    cameraStream: localVideoStream,
                    screenStream: localScreenStream,
                    presentation: localPresentation,
                    connection: null as any,
                    isMuted,
                    isSharingScreen,
                    isVideoEnabled,
                    connectionState: "connected",
                    audioLevel: 0,
                    isSpeaking: false,
                  }}
                  isLocal
                  localUserName={userName}
                  isMuted={isMuted}
                  isSharingScreen={isSharingScreen}
                  isVideoEnabled={isVideoEnabled}
                  localStream={localStream}
                  localPresentation={localPresentation}
                  volume={globalVolume}
                  onClickFocus={() => setFocusedPeerId("local")}
                  isFocusTarget={focusedPeerId === "local"}
                  localUserRole={userRole}
                  onHostAction={agents.triggerHostAction}
                />
              )}

              {/* Remote peers */}
              <AnimatePresence>
                {peerArray.filter(([id]) => id !== effectiveFocusId).map(([id, peer]) => (
                  <PeerCard 
                    key={id} 
                    peer={peer} 
                    volume={globalVolume}
                    isActiveSpeaker={activeSpeakerId === id}
                    onClickFocus={() => setFocusedPeerId(id)}
                    isFocusTarget={focusedPeerId === id}
                    localUserRole={userRole}
                    onHostAction={agents.triggerHostAction}
                  />
                ))}
              </AnimatePresence>

              {/* Empty state */}
              {peerArray.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 opacity-30 dark:opacity-20">
                  <Users className="h-14 w-14 mb-4 text-ah-text-muted" />
                  <p className="text-lg font-medium text-ah-text">Waiting for others...</p>
                  <p className="text-sm font-mono mt-1 text-ah-text-muted">Room: {roomId}</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        <ActivitySidebar activityLog={activityLog} roomUserCount={roomUserCount} />
      </main>

      {/* Control Bar */}
      <ControlBar
        isMuted={isMuted}
        isSharingScreen={isSharingScreen}
        isVideoEnabled={isVideoEnabled}
        onToggleMute={agents.toggleMute}
        onToggleScreenShare={agents.toggleScreenShare}
        onToggleVideo={agents.toggleVideo}
        onSwitchCamera={() => agents.switchCamera()}
        onLeave={() => { agents.disconnect(); onLeave(); }}
        onOpenDeviceSelector={() => setSettingsOpen(true)}
        volume={globalVolume}
        onVolumeChange={setGlobalVolume}
        recordingState={{ isRecording: recording.isRecording, elapsed: recording.elapsed, blob: recording.blob }}
        onStartRecording={() => {
          const streams: MediaStream[] = [];
          if (localStream) streams.push(localStream);
          if (localVideoStream) streams.push(localVideoStream);
          if (localScreenStream) streams.push(localScreenStream);
          recording.startRecording(streams);
        }}
        onStopRecording={recording.stopRecording}
        onDownloadRecording={() => recording.downloadRecording()}
        onClearRecording={recording.clearRecording}
      />

      <ChatPanel
        messages={chatMessages}
        onSendMessage={agents.sendChatMessage}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
      />

      {/* Legacy DeviceSelector — kept for backward compat */}
      <DeviceSelector
        isOpen={deviceSelectorOpen}
        onClose={() => setDeviceSelectorOpen(false)}
        onSelectDevice={agents.switchAudioDevice}
      />

      {/* New comprehensive Settings Modal (Phase 5) */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSelectAudioInput={agents.switchAudioDevice}
        shortcuts={shortcutDefs}
      />

      {/* ── Phase 4 Overlays ──────────────────────────────────────────────── */}
      <ReconnectionOverlay
        health={health}
        onRetry={() => {
          // The socket.io client's built-in reconnection handles this;
          // we just force a re-join emit on reconnect via the existing
          // socket.on("connect") handler in useSignalingAgent.
          // If signaling is dead, disconnect and trigger a page refresh
          // so the effect re-runs and re-creates the socket.
          const socket = (window as any).__audioHubSocket;
          if (socket) {
            socket.connect();
          } else {
            window.location.reload();
          }
        }}
        onLeave={() => { agents.disconnect(); onLeave(); }}
      />

      <PermissionOverlay
        error={permissionError}
        onRetry={() => {
          setPermissionError(null);
          // Reload to re-trigger getUserMedia flow
          window.location.reload();
        }}
        onContinueWithout={() => setPermissionError(null)}
        onLeave={() => { agents.disconnect(); onLeave(); }}
      />

      <ShortcutHelpModal
        isOpen={shortcutModalOpen}
        onClose={closeShortcutModal}
        shortcuts={shortcutDefs}
      />
    </div>
  );
}
