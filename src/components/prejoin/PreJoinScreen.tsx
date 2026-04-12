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
    <div className="relative flex items-center justify-center min-h-[100dvh] p-4 overflow-hidden bg-ah-bg">

      {/* Animated gradient mesh background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -40, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(ellipse_at_center,var(--ah-accent-glow)_0%,transparent_70%)] blur-[80px] opacity-70"
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 50, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-20%] right-[-15%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.65_0.24_285/15%)_0%,transparent_70%)] blur-[80px] opacity-70"
        />
        <motion.div
          animate={{ x: [0, 20, -20, 0], y: [0, 20, -10, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] left-[40%] w-[40%] h-[40%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.1)_0%,transparent_70%)] blur-[80px] opacity-50"
        />
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgNDBoNDBWMEgwem0zOS0xaC0zOFYxaDM4eiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4wMiIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30" />
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
            <div className="p-4 glass-panel rounded-2xl shadow-[0_0_30px_var(--ah-accent-subtle)] relative z-10">
              <Radio className="h-8 w-8 text-ah-accent" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl border border-ah-accent/30"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ah-text">Audio Hub</h1>
          <p className="text-ah-text-muted text-sm mt-1">Crystal-clear voice chat · Screen sharing · Bluetooth optimized</p>
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
                      ? "bg-ah-danger text-white border-ah-danger-glow shadow-[0_0_15px_var(--ah-danger-glow)]"
                      : "bg-ah-control-bg border-ah-glass-border text-ah-text hover:bg-ah-control-hover hover:border-ah-border"
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
                      ? "bg-ah-danger text-white border-ah-danger-glow shadow-[0_0_15px_var(--ah-danger-glow)]"
                      : "bg-ah-control-bg border-ah-glass-border text-ah-text hover:bg-ah-control-hover hover:border-ah-border"
                  )}
                >
                  {startVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Mic test visualizer */}
            <div className="glass-panel border-ah-glass-border bg-ah-surface/40 backdrop-blur-md rounded-2xl p-4 shadow-lg shadow-black/10">
              <MicTestBar stream={previewStream} isMuted={startMuted} />
            </div>

            {/* Device quick-select toggle */}
            <button
              onClick={() => setShowDevices(prev => !prev)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-2xl glass-panel text-ah-text-muted hover:text-ah-text hover:border-ah-border transition-all duration-200 group"
            >
              <div className="flex items-center gap-2 text-sm">
                <Settings2 className="h-4 w-4" />
                <span>{showDevices ? "Hide device settings" : "Select devices"}</span>
              </div>
              <motion.div
                animate={{ rotate: showDevices ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4 rotate-90 group-hover:text-ah-accent transition-colors" />
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
                      colorClass="text-ah-accent"
                    />
                    {/* Camera */}
                    <DeviceSelect
                      label="Camera"
                      icon={<Video className="h-3.5 w-3.5" />}
                      devices={devices.videoInputs}
                      selectedId={devices.preferred.videoInputId ?? ""}
                      onSelect={id => { devices.setPreferredVideoInput(id); startPreview(); }}
                      colorClass="text-blue-400"
                    />
                    {/* Speaker */}
                    {devices.audioOutputs.length > 0 && (
                      <DeviceSelect
                        label="Speaker"
                        icon={<Headphones className="h-3.5 w-3.5" />}
                        devices={devices.audioOutputs}
                        selectedId={devices.preferred.audioOutputId ?? ""}
                        onSelect={devices.setPreferredAudioOutput}
                        colorClass="text-ah-success"
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
            <div className="glass-panel rounded-3xl p-6 space-y-5">

              {/* Display name */}
              {/* Display name */}
              <div className="relative group shadow-sm rounded-xl">
                <Input
                  id="prejoin-name"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="nickname"
                  className="peer bg-ah-surface/60 backdrop-blur-md border border-ah-glass-border focus-visible:border-ah-accent focus-visible:ring-1 focus-visible:ring-ah-accent-glow focus-visible:bg-ah-surface h-14 px-4 pt-[18px] pb-1 text-ah-text text-base rounded-xl transition-all"
                />
                <label
                  htmlFor="prejoin-name"
                  className={cn(
                    "absolute left-4 transition-all duration-200 pointer-events-none peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-[0.1em] peer-focus:text-ah-accent",
                    userName
                      ? "top-2 -translate-y-0 text-[10px] font-bold uppercase tracking-[0.1em] text-ah-text-muted"
                      : "top-1/2 -translate-y-1/2 text-sm text-ah-text-muted"
                  )}
                >
                  Display Name
                </label>
              </div>

              {/* Room ID */}
              <div className="relative shadow-sm rounded-xl">
                <Input
                  id="prejoin-room"
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="peer bg-ah-surface/60 backdrop-blur-md border border-ah-glass-border focus-visible:border-ah-accent focus-visible:ring-1 focus-visible:ring-ah-accent-glow focus-visible:bg-ah-surface h-14 pl-11 pr-20 pt-[18px] pb-1 text-ah-text text-sm font-mono rounded-xl transition-all"
                />
                <Globe className={cn(
                  "absolute left-4 h-4 w-4 transition-all duration-200 pointer-events-none",
                  "top-1/2 -translate-y-1/2 text-ah-text-muted peer-focus:text-ah-accent"
                )} />
                <label
                  htmlFor="prejoin-room"
                  className={cn(
                    "absolute left-11 transition-all duration-200 pointer-events-none peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-[0.1em] peer-focus:text-ah-accent",
                    roomId
                      ? "top-2 -translate-y-0 text-[10px] font-bold uppercase tracking-[0.1em] text-ah-text-muted"
                      : "top-1/2 -translate-y-1/2 text-sm text-ah-text-muted"
                  )}
                >
                  Room ID
                </label>
                
                {/* Actions container inside the input visually */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  {roomId && (
                    <button
                      onClick={handleCopyLink}
                      className="p-1.5 rounded-lg hover:bg-ah-surface-raised transition-colors text-ah-text-muted hover:text-ah-text"
                      title="Copy invite link"
                    >
                      {copied ? <Check className="h-4 w-4 text-ah-success" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    onClick={handleGenerateRoom}
                    className="p-1.5 rounded-lg hover:bg-ah-surface-raised transition-colors text-ah-accent hover:text-ah-accent-hover"
                    title="Generate new room"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Join toggles */}
              <div className="grid grid-cols-2 gap-2">
                <ToggleButton
                  active={startMuted}
                  onClick={toggleMuted}
                  label={startMuted ? "Join Muted" : "Join Unmuted"}
                  icon={startMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  activeClass="bg-ah-danger-glow border-ah-danger/50 text-ah-danger shadow-[0_0_10px_var(--ah-danger-glow)]"
                  inactiveClass="bg-ah-control-bg border-ah-glass-border text-ah-text-muted hover:text-ah-text hover:bg-ah-control-hover hover:border-ah-border"
                />
                <ToggleButton
                  active={startVideoOff}
                  onClick={toggleVideoOff}
                  label={startVideoOff ? "Camera Off" : "Camera On"}
                  icon={startVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  activeClass="bg-ah-danger-glow border-ah-danger/50 text-ah-danger shadow-[0_0_10px_var(--ah-danger-glow)]"
                  inactiveClass="bg-ah-control-bg border-ah-glass-border text-ah-text-muted hover:text-ah-text hover:bg-ah-control-hover hover:border-ah-border"
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2.5 text-sm text-ah-danger bg-ah-danger-glow/30 px-4 py-3 rounded-xl border border-ah-danger/50"
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
                className="w-full h-14 mt-2 bg-gradient-to-r from-ah-accent to-blue-600 hover:from-ah-accent-hover hover:to-blue-700 text-white font-bold text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_var(--ah-accent-glow)] hover:shadow-[0_0_30px_var(--ah-accent-glow)] rounded-xl group disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100 uppercase tracking-wide border border-white/10"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    Join Room
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </motion.div>
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
                  className="flex items-center gap-1.5 text-[10px] font-mono text-ah-text-muted hover:text-ah-text transition-colors cursor-default"
                >
                  <Icon className="h-3 w-3 text-ah-text-faint" />
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
        className="w-full bg-ah-surface border border-ah-border text-ah-text text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-ah-accent transition-colors"
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
