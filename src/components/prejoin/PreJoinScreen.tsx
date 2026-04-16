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
    <div className="relative flex items-center justify-center min-h-[100dvh] p-6 overflow-hidden bg-ah-bg">

      {/* Minimalist ambient backdrop — one static, very subtle radial wash */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, var(--ah-accent-subtle), transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-ah-surface border border-ah-border-subtle">
            <Radio className="h-5 w-5 text-ah-accent" strokeWidth={1.75} />
          </div>
          <h1 className="text-[28px] leading-tight font-medium tracking-tight text-ah-text">Audio Hub</h1>
          <p className="text-ah-text-muted text-sm mt-2 text-balance text-center">
            Crystal-clear voice · Screen sharing · Bluetooth optimized
          </p>
        </div>

        {/* ── Two-column layout: preview + controls ─────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* LEFT: Camera Preview + mic test */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
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
                    "h-9 w-9 flex items-center justify-center rounded-full backdrop-blur-md border transition-all duration-200 active:scale-95",
                    startMuted
                      ? "bg-ah-danger text-white border-transparent"
                      : "bg-ah-control-bg border-ah-border-subtle text-ah-text hover:bg-ah-control-hover"
                  )}
                >
                  {startMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <button
                  onClick={toggleVideoOff}
                  aria-label={startVideoOff ? "Enable camera" : "Disable camera"}
                  className={cn(
                    "h-9 w-9 flex items-center justify-center rounded-full backdrop-blur-md border transition-all duration-200 active:scale-95",
                    startVideoOff
                      ? "bg-ah-danger text-white border-transparent"
                      : "bg-ah-control-bg border-ah-border-subtle text-ah-text hover:bg-ah-control-hover"
                  )}
                >
                  {startVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Mic test visualizer */}
            <div className="rounded-2xl border border-ah-border-subtle bg-ah-surface p-4 shadow-[var(--ah-shadow)]">
              <MicTestBar stream={previewStream} isMuted={startMuted} />
            </div>

            {/* Device quick-select toggle */}
            <button
              onClick={() => setShowDevices(prev => !prev)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-ah-border-subtle bg-ah-surface text-ah-text-muted hover:text-ah-text hover:border-ah-border transition-colors duration-150 group"
            >
              <div className="flex items-center gap-2 text-[13px]">
                <Settings2 className="h-4 w-4" strokeWidth={1.75} />
                <span>{showDevices ? "Hide device settings" : "Select devices"}</span>
              </div>
              <motion.div
                animate={{ rotate: showDevices ? 90 : 0 }}
                transition={{ duration: 0.18 }}
              >
                <ChevronRight className="h-4 w-4 group-hover:text-ah-text transition-colors" strokeWidth={1.75} />
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
                      icon={<Mic className="h-3.5 w-3.5" strokeWidth={1.75} />}
                      devices={devices.audioInputs}
                      selectedId={devices.preferred.audioInputId ?? ""}
                      onSelect={id => { devices.setPreferredAudioInput(id); startPreview(); }}
                      colorClass="text-ah-text-muted"
                    />
                    {/* Camera */}
                    <DeviceSelect
                      label="Camera"
                      icon={<Video className="h-3.5 w-3.5" strokeWidth={1.75} />}
                      devices={devices.videoInputs}
                      selectedId={devices.preferred.videoInputId ?? ""}
                      onSelect={id => { devices.setPreferredVideoInput(id); startPreview(); }}
                      colorClass="text-ah-text-muted"
                    />
                    {/* Speaker */}
                    {devices.audioOutputs.length > 0 && (
                      <DeviceSelect
                        label="Speaker"
                        icon={<Headphones className="h-3.5 w-3.5" strokeWidth={1.75} />}
                        devices={devices.audioOutputs}
                        selectedId={devices.preferred.audioOutputId ?? ""}
                        onSelect={devices.setPreferredAudioOutput}
                        colorClass="text-ah-text-muted"
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* RIGHT: Identity + Room form */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-4"
          >
            <div className="rounded-2xl border border-ah-border-subtle bg-ah-surface p-5 sm:p-6 space-y-4 shadow-[var(--ah-shadow)]">

              {/* Display name */}
              <div className="relative">
                <Input
                  id="prejoin-name"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="nickname"
                  className="peer bg-ah-surface border border-ah-border focus-visible:border-ah-accent focus-visible:ring-2 focus-visible:ring-ah-accent/20 h-12 px-3.5 pt-[16px] pb-1 text-ah-text text-[15px] rounded-xl transition-colors duration-150"
                />
                <label
                  htmlFor="prejoin-name"
                  className={cn(
                    "absolute left-3.5 transition-all duration-150 pointer-events-none peer-focus:top-1.5 peer-focus:-translate-y-0 peer-focus:text-[10px] peer-focus:font-medium peer-focus:tracking-wide peer-focus:text-ah-accent",
                    userName
                      ? "top-1.5 -translate-y-0 text-[10px] font-medium tracking-wide text-ah-text-muted"
                      : "top-1/2 -translate-y-1/2 text-sm text-ah-text-muted"
                  )}
                >
                  Display name
                </label>
              </div>

              {/* Room ID */}
              <div className="relative">
                <Input
                  id="prejoin-room"
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="peer bg-ah-surface border border-ah-border focus-visible:border-ah-accent focus-visible:ring-2 focus-visible:ring-ah-accent/20 h-12 pl-10 pr-20 pt-[16px] pb-1 text-ah-text text-[13px] font-mono rounded-xl transition-colors duration-150"
                />
                <Globe className={cn(
                  "absolute left-3.5 h-4 w-4 transition-colors duration-150 pointer-events-none",
                  "top-1/2 -translate-y-1/2 text-ah-text-muted peer-focus:text-ah-accent"
                )} strokeWidth={1.75} />
                <label
                  htmlFor="prejoin-room"
                  className={cn(
                    "absolute left-10 transition-all duration-150 pointer-events-none peer-focus:top-1.5 peer-focus:-translate-y-0 peer-focus:text-[10px] peer-focus:font-medium peer-focus:tracking-wide peer-focus:text-ah-accent",
                    roomId
                      ? "top-1.5 -translate-y-0 text-[10px] font-medium tracking-wide text-ah-text-muted"
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
                  activeClass="bg-ah-danger-glow border-ah-danger/40 text-ah-danger"
                  inactiveClass="bg-ah-control-bg border-ah-border-subtle text-ah-text-muted hover:text-ah-text hover:bg-ah-control-hover"
                />
                <ToggleButton
                  active={startVideoOff}
                  onClick={toggleVideoOff}
                  label={startVideoOff ? "Camera Off" : "Camera On"}
                  icon={startVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  activeClass="bg-ah-danger-glow border-ah-danger/40 text-ah-danger"
                  inactiveClass="bg-ah-control-bg border-ah-border-subtle text-ah-text-muted hover:text-ah-text hover:bg-ah-control-hover"
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2.5 text-[13px] text-ah-danger bg-ah-danger-glow/40 px-3.5 py-2.5 rounded-xl border border-ah-danger/30"
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
                className="w-full h-12 mt-1 bg-ah-accent hover:bg-ah-accent-hover text-white text-[15px] font-medium rounded-xl transition-all duration-200 active:scale-[0.99] shadow-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    Join Room
                    <ChevronRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {/* Feature badges — quiet, single line */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 px-2 pt-1">
              {[
                { icon: Shield,     label: "Encrypted" },
                { icon: Zap,        label: "Low latency" },
                { icon: Headphones, label: "BT optimized" },
                { icon: Globe,      label: "Global" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 text-[11px] text-ah-text-faint"
                >
                  <Icon className="h-3 w-3" strokeWidth={1.75} />
                  {label}
                </div>
              ))}
            </div>
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
      <div className={cn("flex items-center gap-1.5 text-[11px] font-medium tracking-wide", colorClass)}>
        {icon}
        {label}
      </div>
      <select
        value={selectedId}
        onChange={e => onSelect(e.target.value)}
        className="w-full bg-ah-surface border border-ah-border text-ah-text text-[13px] rounded-xl px-3 py-2.5 focus:outline-none focus:border-ah-accent focus:ring-2 focus:ring-ah-accent/20 transition-colors duration-150"
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
        "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-medium transition-colors duration-150 cursor-pointer active:scale-[0.98]",
        active ? activeClass : inactiveClass
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
