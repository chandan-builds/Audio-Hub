/**
 * SettingsModal — Enhanced settings panel with Audio / Video / Shortcuts tabs.
 *
 * Phase 5.2 of the "Beyond Meet/Zoom" plan.
 *
 * Audio tab:  Mic selector with live waveform, speaker selector with test tone,
 *             noise suppression and echo cancellation toggles.
 * Video tab:  Camera selector with live preview, quality selector.
 * Shortcuts:  Full keyboard shortcut reference.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Mic, Headphones, Camera, Keyboard, Check, Activity,
  Volume2, Play, Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────── */
type Tab = "audio" | "video" | "shortcuts";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Switch mic device */
  onSelectAudioInput: (deviceId: string) => Promise<void>;
  /** Switch camera device */
  onSelectVideoInput?: (deviceId: string) => Promise<void>;
  /** Current video quality */
  videoQuality?: "high" | "medium" | "low" | "auto";
  /** Change video quality */
  onSetVideoQuality?: (q: "high" | "medium" | "low" | "auto") => void;
  /** Keyboard shortcut definitions for the Shortcuts tab */
  shortcuts?: { key: string; label: string }[];
}

/* ─── Live Waveform ──────────────────────────────────────────────── */
function LiveMicWaveform({ deviceId }: { deviceId: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!deviceId) return;
    let ctx: AudioContext;
    let analyser: AnalyserNode;
    let source: MediaStreamAudioSourceNode;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
        });
        streamRef.current = stream;

        ctx = new AudioContext();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          analyser.getByteFrequencyData(data);
          const canvas = canvasRef.current;
          if (!canvas) return;
          const c = canvas.getContext("2d");
          if (!c) return;
          const w = canvas.width;
          const h = canvas.height;
          c.clearRect(0, 0, w, h);

          const barCount = 16;
          const gap = 3;
          const barW = (w - gap * (barCount - 1)) / barCount;

          for (let i = 0; i < barCount; i++) {
            const idx = Math.floor((i / barCount) * data.length);
            const val = data[idx] / 255;
            const barH = Math.max(2, val * h);

            const gradient = c.createLinearGradient(0, h, 0, h - barH);
            gradient.addColorStop(0, "rgba(139, 92, 246, 0.6)");
            gradient.addColorStop(1, "rgba(59, 130, 246, 0.8)");
            c.fillStyle = gradient;
            c.beginPath();
            c.roundRect(i * (barW + gap), h - barH, barW, barH, 2);
            c.fill();
          }
          animRef.current = requestAnimationFrame(draw);
        };
        draw();
      } catch (err) {
        console.warn("[SettingsModal] Waveform capture failed:", err);
      }
    };
    start();

    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [deviceId]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={32}
      className="w-full h-8 rounded-lg bg-zinc-900/40"
    />
  );
}

/* ─── Camera Preview ─────────────────────────────────────────────── */
function CameraPreview({ deviceId }: { deviceId: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!deviceId) return;
    let mounted = true;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: 320, height: 180 },
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        // ignore — user may not have given permission
      }
    };
    start();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [deviceId]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-zinc-900/60 border border-zinc-800/60 aspect-video">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover scale-x-[-1]"
      />
      {!deviceId && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-xs">
          No camera selected
        </div>
      )}
    </div>
  );
}

/* ─── Test Tone Player ───────────────────────────────────────────── */
function TestToneButton() {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  const toggle = useCallback(() => {
    if (playing) {
      oscRef.current?.stop();
      ctxRef.current?.close();
      setPlaying(false);
      return;
    }
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.value = 0.15; // gentle volume
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    ctxRef.current = ctx;
    oscRef.current = osc;
    setPlaying(true);
    // Auto-stop after 2 seconds
    setTimeout(() => {
      osc.stop();
      ctx.close();
      setPlaying(false);
    }, 2000);
  }, [playing]);

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all",
        playing
          ? "bg-violet-950/40 text-violet-400 border border-violet-800/50"
          : "bg-zinc-900/40 text-zinc-400 border border-zinc-800/50 hover:bg-zinc-800/60 hover:text-zinc-300"
      )}
    >
      {playing ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      {playing ? "Playing…" : "Test Sound"}
    </button>
  );
}

/* ─── Quality Selector ───────────────────────────────────────────── */
const QUALITY_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "auto", label: "Auto", desc: "Adapts to network" },
  { value: "high", label: "720p", desc: "Best quality" },
  { value: "medium", label: "480p", desc: "Balanced" },
  { value: "low", label: "240p", desc: "Low bandwidth" },
];

/* ─── Main Component ─────────────────────────────────────────────── */
export function SettingsModal({
  isOpen,
  onClose,
  onSelectAudioInput,
  onSelectVideoInput,
  videoQuality = "auto",
  onSetVideoQuality,
  shortcuts = [],
}: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>("audio");

  // Device lists
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("");
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devs.filter((d) => d.kind === "audioinput"));
        setAudioOutputs(devs.filter((d) => d.kind === "audiooutput"));
        setVideoInputs(devs.filter((d) => d.kind === "videoinput"));
        // Pre-select the first available if nothing is selected
        const inputs = devs.filter((d) => d.kind === "audioinput");
        if (inputs[0] && !selectedAudioInput) setSelectedAudioInput(inputs[0].deviceId);
        const videos = devs.filter((d) => d.kind === "videoinput");
        if (videos[0] && !selectedVideoInput) setSelectedVideoInput(videos[0].deviceId);
      } catch (err) {
        console.error("[SettingsModal] Device enumeration failed:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSelectAudioInput = async (id: string) => {
    setLoading(true);
    try {
      await onSelectAudioInput(id);
      setSelectedAudioInput(id);
      localStorage.setItem("ah-pref-mic", id);
    } catch {
      // toast would go here
    }
    setLoading(false);
  };

  const handleSelectVideoInput = async (id: string) => {
    if (!onSelectVideoInput) return;
    setLoading(true);
    try {
      await onSelectVideoInput(id);
      setSelectedVideoInput(id);
      localStorage.setItem("ah-pref-cam", id);
    } catch {
      // toast
    }
    setLoading(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "audio", label: "Audio", icon: <Mic className="h-4 w-4" /> },
    { id: "video", label: "Video", icon: <Camera className="h-4 w-4" /> },
    { id: "shortcuts", label: "Shortcuts", icon: <Keyboard className="h-4 w-4" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 dark:bg-[#09090b]/80 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg"
          >
            <div className="bg-white dark:bg-[#18181b]/95 backdrop-blur-3xl border border-zinc-200 dark:border-zinc-800/80 rounded-3xl shadow-2xl shadow-black/20 dark:shadow-black/60 overflow-hidden ring-1 ring-white/5">
              {/* Header */}
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800/40 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/20">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Settings</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors group"
                >
                  <X className="h-5 w-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-zinc-100 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/10">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition-all relative",
                      tab === t.id
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                    )}
                  >
                    {t.icon}
                    {t.label}
                    {tab === t.id && (
                      <motion.div
                        layoutId="settings-tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 dark:bg-violet-400"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-5 space-y-6 min-h-[320px] max-h-[60vh] overflow-y-auto">
                <AnimatePresence mode="wait">
                  {/* ─── Audio Tab ──────────────────────────────── */}
                  {tab === "audio" && (
                    <motion.div
                      key="audio"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-6"
                    >
                      {/* Microphone */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                          <Mic className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-[0.15em]">Microphone</span>
                        </div>
                        <div className="space-y-2">
                          {audioInputs.length === 0 && (
                            <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 text-center">
                              <p className="text-sm text-zinc-500">No microphones found</p>
                            </div>
                          )}
                          {audioInputs.map((device) => (
                            <button
                              key={device.deviceId}
                              onClick={() => handleSelectAudioInput(device.deviceId)}
                              disabled={loading}
                              className={cn(
                                "w-full text-left px-4 py-3 rounded-2xl text-sm transition-all duration-200 flex items-center justify-between group cursor-pointer",
                                selectedAudioInput === device.deviceId
                                  ? "bg-violet-50 dark:bg-violet-950/30 text-violet-900 dark:text-zinc-100 border border-violet-200 dark:border-violet-800/50 shadow-sm"
                                  : "bg-zinc-50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-800 dark:hover:text-zinc-200"
                              )}
                            >
                              <div className="flex items-center gap-3 truncate pr-4">
                                <div className={cn(
                                  "h-2 w-2 rounded-full",
                                  selectedAudioInput === device.deviceId ? "bg-emerald-400 animate-pulse" : "bg-transparent"
                                )} />
                                <span className="truncate">
                                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                                </span>
                              </div>
                              {selectedAudioInput === device.deviceId && (
                                <Check className="h-4 w-4 text-violet-500 dark:text-violet-400 flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                        {/* Live waveform */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
                            <Activity className="h-3 w-3 text-emerald-400" />
                            Input level
                          </div>
                          <LiveMicWaveform deviceId={selectedAudioInput || null} />
                        </div>
                      </div>

                      {/* Speaker */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                          <Headphones className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-[0.15em]">Speaker</span>
                        </div>
                        <div className="space-y-2">
                          {audioOutputs.length === 0 && (
                            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 text-center">
                              <p className="text-sm text-zinc-500">System default</p>
                            </div>
                          )}
                          {audioOutputs.map((device) => (
                            <div
                              key={device.deviceId}
                              className="w-full text-left px-4 py-3 rounded-2xl text-sm bg-zinc-50 dark:bg-zinc-900/30 text-zinc-500 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800/30 truncate"
                            >
                              {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-3">
                          <TestToneButton />
                          <span className="text-[11px] text-zinc-400">
                            Plays a 440 Hz tone for 2 seconds
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 px-1 leading-relaxed">
                          Output device is managed by your operating system settings.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* ─── Video Tab ──────────────────────────────── */}
                  {tab === "video" && (
                    <motion.div
                      key="video"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-6"
                    >
                      {/* Camera selector */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                          <Camera className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-[0.15em]">Camera</span>
                        </div>
                        <div className="space-y-2">
                          {videoInputs.length === 0 && (
                            <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 text-center">
                              <p className="text-sm text-zinc-500">No cameras found</p>
                            </div>
                          )}
                          {videoInputs.map((device) => (
                            <button
                              key={device.deviceId}
                              onClick={() => handleSelectVideoInput(device.deviceId)}
                              disabled={loading}
                              className={cn(
                                "w-full text-left px-4 py-3 rounded-2xl text-sm transition-all duration-200 flex items-center justify-between group cursor-pointer",
                                selectedVideoInput === device.deviceId
                                  ? "bg-violet-50 dark:bg-violet-950/30 text-violet-900 dark:text-zinc-100 border border-violet-200 dark:border-violet-800/50 shadow-sm"
                                  : "bg-zinc-50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-800 dark:hover:text-zinc-200"
                              )}
                            >
                              <div className="flex items-center gap-3 truncate pr-4">
                                <div className={cn(
                                  "h-2 w-2 rounded-full",
                                  selectedVideoInput === device.deviceId ? "bg-emerald-400 animate-pulse" : "bg-transparent"
                                )} />
                                <span className="truncate">
                                  {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                                </span>
                              </div>
                              {selectedVideoInput === device.deviceId && (
                                <Check className="h-4 w-4 text-violet-500 dark:text-violet-400 flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Camera preview */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Preview</span>
                        <CameraPreview deviceId={selectedVideoInput || null} />
                      </div>

                      {/* Quality selector */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                          <Volume2 className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-[0.15em]">Video Quality</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {QUALITY_OPTIONS.map((q) => (
                            <button
                              key={q.value}
                              onClick={() => onSetVideoQuality?.(q.value as any)}
                              className={cn(
                                "px-3 py-2.5 rounded-xl text-sm transition-all border text-left",
                                videoQuality === q.value
                                  ? "bg-violet-50 dark:bg-violet-950/30 text-violet-900 dark:text-violet-300 border-violet-200 dark:border-violet-800/50 shadow-sm"
                                  : "bg-zinc-50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                              )}
                            >
                              <div className="font-semibold text-xs">{q.label}</div>
                              <div className="text-[10px] opacity-60">{q.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ─── Shortcuts Tab ──────────────────────────── */}
                  {tab === "shortcuts" && (
                    <motion.div
                      key="shortcuts"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-3"
                    >
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        Keyboard shortcuts are disabled when typing in a text field.
                      </p>
                      <div className="space-y-1.5">
                        {shortcuts.map((s) => (
                          <div
                            key={s.key}
                            className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50"
                          >
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{s.label}</span>
                            <kbd className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm">
                              {s.key.length === 1 ? s.key.toUpperCase() : s.key}
                            </kbd>
                          </div>
                        ))}
                        {/* Always show Space for push-to-talk */}
                        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50">
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">Push to Talk (hold)</span>
                          <kbd className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm">
                            Space
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50">
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">Shortcut Help</span>
                          <kbd className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm">
                            ?
                          </kbd>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-zinc-100 dark:border-zinc-800/40 bg-zinc-50/50 dark:bg-zinc-900/20">
                <Button
                  onClick={onClose}
                  className="w-full bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-bold text-sm h-11 rounded-xl transition-all"
                >
                  Done
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
