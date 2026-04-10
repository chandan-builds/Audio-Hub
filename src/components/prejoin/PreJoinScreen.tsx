import React, { useState, useEffect, useCallback, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Radio, Globe, Shield, Zap, Headphones, ChevronRight, Copy, Check,
  Sparkles, Mic, MicOff, Video, VideoOff, Settings2, AlertCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CameraPreview } from "./CameraPreview";
import { MicTestBar } from "./MicTestBar";
import { useDeviceManager } from "@/src/hooks/useDeviceManager";
import { cn } from "@/lib/utils";

interface PreJoinScreenProps {
  onJoinRoom: (roomId: string, userName: string, joinPrefs: JoinPreferences) => void;
  initialRoomId?: string;
}

export interface JoinPreferences {
  startMuted: boolean;
  startVideoOff: boolean;
  preferredAudioInputId: string | null;
  preferredVideoInputId: string | null;
  preferredAudioOutputId: string | null;
}

function generateRoomId(): string {
  const adjectives = ["cosmic", "stellar", "neon", "quantum", "hyper", "sonic", "turbo", "cyber", "astro", "mega"];
  const nouns = ["hub", "zone", "nexus", "space", "realm", "arena", "lounge", "den", "core", "deck"];
  const adj  = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num  = Math.floor(Math.random() * 999);
  return `${adj}-${noun}-${num}`;
}

const PREFS_KEY = "audiohub_join_prefs";
function loadJoinPrefs(): Partial<JoinPreferences> {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); } catch { return {}; }
}
function saveJoinPrefs(p: Partial<JoinPreferences>) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

export function PreJoinScreen({ onJoinRoom, initialRoomId = "" }: PreJoinScreenProps) {
  const [userName, setUserName]       = useState(() => localStorage.getItem("audiohub_username") || "");
  const [roomId, setRoomId]           = useState(initialRoomId);
  const [error, setError]             = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const [isJoining, setIsJoining]     = useState(false);
  const [showDevices, setShowDevices] = useState(false);

  const savedPrefs = loadJoinPrefs();
  const [startMuted,    setStartMuted]    = useState(savedPrefs.startMuted    ?? false);
  const [startVideoOff, setStartVideoOff] = useState(savedPrefs.startVideoOff ?? false);

  const devices = useDeviceManager();

  // Live preview stream (mic + camera)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const startPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const constraints: MediaStreamConstraints = {
        audio: devices.preferred.audioInputId
          ? { deviceId: { exact: devices.preferred.audioInputId } }
          : true,
        video: startVideoOff ? false : (
          devices.preferred.videoInputId
            ? { deviceId: { exact: devices.preferred.videoInputId }, width: 1280, height: 720 }
            : { width: 1280, height: 720 }
        ),
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setPreviewStream(stream);
    } catch {
      // Permission denied or no device — try audio only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setPreviewStream(stream);
      } catch {
        setPreviewStream(null);
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [devices.preferred.audioInputId, devices.preferred.videoInputId, startVideoOff]);

  // Start preview on mount, restart when device prefs change
  useEffect(() => {
    startPreview();
    return () => {
      // Cleanup preview stream on unmount
    };
  }, [devices.preferred.audioInputId, devices.preferred.videoInputId]);

  // Stop preview tracks when leaving this screen
  useEffect(() => {
    return () => {
      previewStream?.getTracks().forEach(t => t.stop());
    };
  }, [previewStream]);

  // Sync URL room param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room && !roomId) setRoomId(room);
  }, []);

  const handleJoin = useCallback(async () => {
    const name = userName.trim();
    const room = roomId.trim();
    if (!name) { setError("Please enter your display name."); return; }
    if (!room) { setError("Please enter or generate a Room ID."); return; }
    setError(null);
    setIsJoining(true);

    // Stop preview stream before handing off (room will acquire its own)
    previewStream?.getTracks().forEach(t => t.stop());

    const prefs: JoinPreferences = {
      startMuted,
      startVideoOff,
      preferredAudioInputId:  devices.preferred.audioInputId,
      preferredVideoInputId:  devices.preferred.videoInputId,
      preferredAudioOutputId: devices.preferred.audioOutputId,
    };
    saveJoinPrefs({ startMuted, startVideoOff });
    localStorage.setItem("audiohub_username", name);

    onJoinRoom(room, name, prefs);
  }, [userName, roomId, startMuted, startVideoOff, devices.preferred, previewStream, onJoinRoom]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleJoin();
  };

  const handleGenerateRoom = () => setRoomId(generateRoomId());

  const handleCopyLink = async () => {
    if (!roomId) return;
    const link = `${window.location.origin}?room=${roomId}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleVideoOff = () => {
    setStartVideoOff(prev => !prev);
    if (previewStream) {
      previewStream.getVideoTracks().forEach(t => { t.enabled = startVideoOff; });
    }
  };

  const toggleMuted = () => {
    setStartMuted(prev => !prev);
    if (previewStream) {
      previewStream.getAudioTracks().forEach(t => { t.enabled = startMuted; });
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-[100dvh] p-4 overflow-hidden bg-[#09090b]">

      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-violet-950/20 to-transparent rounded-full blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-emerald-950/15 to-transparent rounded-full blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, 15, 0], y: [0, 15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] left-[50%] w-[30%] h-[30%] bg-gradient-to-r from-fuchsia-950/10 to-transparent rounded-full blur-[120px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="relative mb-4">
            <div className="p-4 bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 rounded-2xl border border-zinc-700/50 shadow-lg shadow-black/20">
              <Radio className="h-8 w-8 text-violet-400" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl border border-violet-500/30"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Audio Hub</h1>
          <p className="text-zinc-400 text-sm mt-1">Crystal-clear voice chat · Screen sharing · Bluetooth optimized</p>
        </motion.div>

        {/* ── Two-column layout: preview + controls ─────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* LEFT: Camera Preview + mic test */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex flex-col gap-4"
          >
            {/* Camera preview */}
            <div className="relative">
              <CameraPreview
                stream={previewStream}
                isLoading={previewLoading}
                fallbackName={userName || "You"}
              />
              {/* Preview overlay controls */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button
                  onClick={toggleMuted}
                  aria-label={startMuted ? "Unmute microphone" : "Mute microphone"}
                  className={cn(
                    "p-2.5 rounded-full backdrop-blur-md border transition-all duration-200",
                    startMuted
                      ? "bg-red-500/90 border-red-400/50 text-white"
                      : "bg-zinc-900/80 border-zinc-700/60 text-zinc-300 hover:border-zinc-600"
                  )}
                >
                  {startMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <button
                  onClick={toggleVideoOff}
                  aria-label={startVideoOff ? "Enable camera" : "Disable camera"}
                  className={cn(
                    "p-2.5 rounded-full backdrop-blur-md border transition-all duration-200",
                    startVideoOff
                      ? "bg-red-500/90 border-red-400/50 text-white"
                      : "bg-zinc-900/80 border-zinc-700/60 text-zinc-300 hover:border-zinc-600"
                  )}
                >
                  {startVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Mic test visualizer */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 backdrop-blur-sm">
              <MicTestBar stream={previewStream} isMuted={startMuted} />
            </div>

            {/* Device quick-select toggle */}
            <button
              onClick={() => setShowDevices(prev => !prev)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all duration-200 group"
            >
              <div className="flex items-center gap-2 text-sm">
                <Settings2 className="h-4 w-4" />
                <span>{showDevices ? "Hide device settings" : "Select devices"}</span>
              </div>
              <motion.div
                animate={{ rotate: showDevices ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4 rotate-90 group-hover:text-violet-400 transition-colors" />
              </motion.div>
            </button>

            {/* Expandable device panels */}
            <AnimatePresence>
              {showDevices && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-0.5">
                    {/* Microphone */}
                    <DeviceSelect
                      label="Microphone"
                      icon={<Mic className="h-3.5 w-3.5" />}
                      devices={devices.audioInputs}
                      selectedId={devices.preferred.audioInputId ?? ""}
                      onSelect={id => { devices.setPreferredAudioInput(id); startPreview(); }}
                      colorClass="text-violet-400"
                    />
                    {/* Camera */}
                    <DeviceSelect
                      label="Camera"
                      icon={<Video className="h-3.5 w-3.5" />}
                      devices={devices.videoInputs}
                      selectedId={devices.preferred.videoInputId ?? ""}
                      onSelect={id => { devices.setPreferredVideoInput(id); startPreview(); }}
                      colorClass="text-cyan-400"
                    />
                    {/* Speaker */}
                    {devices.audioOutputs.length > 0 && (
                      <DeviceSelect
                        label="Speaker"
                        icon={<Headphones className="h-3.5 w-3.5" />}
                        devices={devices.audioOutputs}
                        selectedId={devices.preferred.audioOutputId ?? ""}
                        onSelect={devices.setPreferredAudioOutput}
                        colorClass="text-emerald-400"
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* RIGHT: Identity + Room form */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="flex flex-col gap-4"
          >
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-3xl p-6 backdrop-blur-sm space-y-5">

              {/* Display name */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
                  Display Name
                </label>
                <Input
                  id="prejoin-name"
                  placeholder="What should we call you?"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="nickname"
                  className="bg-zinc-950/50 border-zinc-700/50 focus:border-violet-600/50 h-12 px-4 text-zinc-100 placeholder:text-zinc-600 rounded-xl"
                />
              </div>

              {/* Room ID */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
                    Room ID
                  </label>
                  <button
                    onClick={handleGenerateRoom}
                    className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1 font-medium"
                  >
                    <Sparkles className="h-3 w-3" />
                    Generate
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Globe className="absolute left-3.5 h-4 w-4 text-zinc-600 pointer-events-none" />
                  <Input
                    id="prejoin-room"
                    placeholder="e.g. cosmic-nexus-42"
                    value={roomId}
                    onChange={e => setRoomId(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-zinc-950/50 border-zinc-700/50 focus:border-violet-600/50 h-12 pl-10 pr-10 text-zinc-100 placeholder:text-zinc-600 rounded-xl font-mono text-sm"
                  />
                  {roomId && (
                    <button
                      onClick={handleCopyLink}
                      className="absolute right-3 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      title="Copy invite link"
                    >
                      {copied
                        ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                        : <Copy className="h-3.5 w-3.5 text-zinc-500" />
                      }
                    </button>
                  )}
                </div>
              </div>

              {/* Join toggles */}
              <div className="grid grid-cols-2 gap-2">
                <ToggleButton
                  active={startMuted}
                  onClick={toggleMuted}
                  label={startMuted ? "Join Muted" : "Join Unmuted"}
                  icon={startMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  activeClass="bg-red-950/50 border-red-800/60 text-red-300"
                  inactiveClass="bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
                />
                <ToggleButton
                  active={startVideoOff}
                  onClick={toggleVideoOff}
                  label={startVideoOff ? "Camera Off" : "Camera On"}
                  icon={startVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  activeClass="bg-red-950/50 border-red-800/60 text-red-300"
                  inactiveClass="bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2.5 text-sm text-red-400 bg-red-950/30 px-4 py-3 rounded-xl border border-red-900/50"
                  >
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Join button */}
              <Button
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full h-13 bg-violet-600 hover:bg-violet-500 text-white font-bold text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-violet-900/30 rounded-xl group disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    Join Room
                    <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>

            {/* Feature badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap justify-center gap-5 px-2"
            >
              {[
                { icon: Shield,     label: "ENCRYPTED" },
                { icon: Zap,        label: "LOW LATENCY" },
                { icon: Headphones, label: "BT OPTIMIZED" },
                { icon: Globe,      label: "GLOBAL" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors cursor-default"
                >
                  <Icon className="h-3 w-3 text-zinc-600" />
                  {label}
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeviceSelect({
  label, icon, devices, selectedId, onSelect, colorClass,
}: {
  label: string;
  icon: React.ReactNode;
  devices: MediaDeviceInfo[];
  selectedId: string;
  onSelect: (id: string) => void;
  colorClass: string;
}) {
  if (devices.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className={cn("flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]", colorClass)}>
        {icon}
        {label}
      </div>
      <select
        value={selectedId}
        onChange={e => onSelect(e.target.value)}
        className="w-full bg-zinc-950/60 border border-zinc-800/70 text-zinc-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-600/50 transition-colors"
        aria-label={`Select ${label}`}
      >
        {devices.map(d => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${label} ${d.deviceId.slice(0, 6)}`}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleButton({
  active, onClick, label, icon, activeClass, inactiveClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
  inactiveClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer",
        active ? activeClass : inactiveClass
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
