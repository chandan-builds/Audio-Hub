/**
 * SettingsModal — Audio / Video / Shortcuts tabs.
 * Phase 6 — full glassmorphism design-token pass.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Mic, Headphones, Camera, Keyboard, Check, Activity,
  Volume2, Play, Square, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "audio" | "video" | "shortcuts";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAudioInput: (deviceId: string) => Promise<void>;
  onSelectVideoInput?: (deviceId: string) => Promise<void>;
  videoQuality?: "high" | "medium" | "low" | "auto";
  onSetVideoQuality?: (q: "high" | "medium" | "low" | "auto") => void;
  shortcuts?: { key: string; label: string }[];
}

/* ─── Live Mic Waveform ────────────────────────────────────────────────────── */
function LiveMicWaveform({ deviceId }: { deviceId: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
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
        ctx      = new AudioContext();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source   = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          analyser.getByteFrequencyData(data);
          const canvas = canvasRef.current;
          if (!canvas) return;
          const c = canvas.getContext("2d");
          if (!c) return;
          const { width: w, height: h } = canvas;
          c.clearRect(0, 0, w, h);

          const barCount = 20;
          const gap      = 3;
          const barW     = (w - gap * (barCount - 1)) / barCount;

          for (let i = 0; i < barCount; i++) {
            const idx  = Math.floor((i / barCount) * data.length);
            const val  = data[idx] / 255;
            const barH = Math.max(2, val * h);
            const grad = c.createLinearGradient(0, h, 0, h - barH);
            grad.addColorStop(0, "oklch(0.55 0.22 265 / 0.55)");
            grad.addColorStop(1, "oklch(0.70 0.18 265 / 0.90)");
            c.fillStyle = grad;
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
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [deviceId]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={36}
      className="w-full h-9 rounded-xl bg-ah-surface-raised border border-ah-glass-border"
    />
  );
}

/* ─── Camera Preview ───────────────────────────────────────────────────────── */
function CameraPreview({ deviceId }: { deviceId: string | null }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!deviceId) return;
    let mounted = true;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: 320, height: 180 },
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch { /* permission not yet granted */ }
    };
    start();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [deviceId]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-ah-surface-raised border border-ah-glass-border aspect-video">
      <video
        ref={videoRef}
        autoPlay muted playsInline
        className="w-full h-full object-cover scale-x-[-1]"
      />
      {!deviceId && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-ah-text-subtle">No camera selected</span>
        </div>
      )}
    </div>
  );
}

/* ─── Test Tone ────────────────────────────────────────────────────────────── */
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
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    ctxRef.current = ctx;
    oscRef.current = osc;
    setPlaying(true);
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
        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border",
        playing
          ? "bg-violet-500/15 border-violet-400/30 text-violet-300"
          : "bg-ah-glass border-ah-glass-border text-ah-text-muted hover:text-ah-text hover:bg-ah-surface-raised"
      )}
    >
      {playing ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      {playing ? "Playing…" : "Test Sound"}
    </button>
  );
}

/* ─── Quality Options ──────────────────────────────────────────────────────── */
const QUALITY_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "auto",   label: "Auto",  desc: "Adapts to network" },
  { value: "high",   label: "720p",  desc: "Best quality"      },
  { value: "medium", label: "480p",  desc: "Balanced"          },
  { value: "low",    label: "240p",  desc: "Saves bandwidth"   },
];

/* ─── Device Row ───────────────────────────────────────────────────────────── */
function DeviceRow({
  label, isSelected, onClick, disabled,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full text-left px-4 py-3 rounded-2xl text-[13px] transition-all duration-150",
        "flex items-center justify-between gap-3 border",
        isSelected
          ? "bg-violet-500/15 border-violet-400/30 text-ah-text shadow-sm shadow-violet-500/10"
          : "bg-ah-glass border-ah-glass-border text-ah-text-muted hover:text-ah-text hover:bg-ah-surface-raised"
      )}
    >
      <div className="flex items-center gap-3 truncate">
        <div className={cn(
          "h-2 w-2 rounded-full shrink-0 transition-all",
          isSelected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-transparent"
        )} />
        <span className="truncate">{label}</span>
      </div>
      {isSelected && <Check className="h-4 w-4 text-violet-400 shrink-0" />}
    </button>
  );
}

/* ─── Section Header ───────────────────────────────────────────────────────── */
function SectionLabel({ icon, label, accent = false }: { icon: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em]",
      accent ? "text-violet-400" : "text-ah-text-muted"
    )}>
      {icon}
      {label}
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */
export function SettingsModal({
  isOpen, onClose,
  onSelectAudioInput, onSelectVideoInput,
  videoQuality = "auto", onSetVideoQuality,
  shortcuts = [],
}: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>("audio");
  const [audioInputs, setAudioInputs]   = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs]   = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [selectedVideoInput, setSelectedVideoInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const ai = devs.filter(d => d.kind === "audioinput");
        const ao = devs.filter(d => d.kind === "audiooutput");
        const vi = devs.filter(d => d.kind === "videoinput");
        setAudioInputs(ai);
        setAudioOutputs(ao);
        setVideoInputs(vi);
        if (ai[0] && !selectedAudioInput) setSelectedAudioInput(ai[0].deviceId);
        if (vi[0] && !selectedVideoInput) setSelectedVideoInput(vi[0].deviceId);
      } catch (err) {
        console.error("[SettingsModal] Device enumeration failed:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAudio = async (id: string) => {
    setLoading(true);
    try { await onSelectAudioInput(id); setSelectedAudioInput(id); localStorage.setItem("ah-pref-mic", id); }
    catch { /* toast */ }
    setLoading(false);
  };

  const handleVideo = async (id: string) => {
    if (!onSelectVideoInput) return;
    setLoading(true);
    try { await onSelectVideoInput(id); setSelectedVideoInput(id); localStorage.setItem("ah-pref-cam", id); }
    catch { /* toast */ }
    setLoading(false);
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "audio",     label: "Audio",     icon: <Mic     className="h-4 w-4" /> },
    { id: "video",     label: "Video",     icon: <Camera  className="h-4 w-4" /> },
    { id: "shortcuts", label: "Shortcuts", icon: <Keyboard className="h-4 w-4" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-lg"
          />

          {/* Modal */}
          <motion.div
            key="settings-modal"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg px-4"
          >
            <div className="bg-ah-surface/90 backdrop-blur-3xl border border-ah-glass-border rounded-3xl shadow-2xl shadow-black/50 overflow-hidden">

              {/* ── Header ── */}
              <div className="px-6 py-5 border-b border-ah-glass-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-violet-500/15 border border-violet-400/20 flex items-center justify-center">
                    <Settings2 className="h-4 w-4 text-violet-400" />
                  </div>
                  <h2 className="text-base font-bold text-ah-text">Settings</h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close settings"
                  className="h-8 w-8 flex items-center justify-center rounded-xl text-ah-text-muted hover:text-ah-text hover:bg-ah-glass border border-transparent hover:border-ah-glass-border transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ── Tabs ── */}
              <div className="flex border-b border-ah-glass-border bg-ah-surface-raised/30">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-bold uppercase tracking-widest transition-all relative",
                      tab === t.id
                        ? "text-violet-400"
                        : "text-ah-text-subtle hover:text-ah-text-muted"
                    )}
                  >
                    {t.icon}
                    {t.label}
                    {tab === t.id && (
                      <motion.div
                        layoutId="settings-tab-line"
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-violet-500 rounded-full"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* ── Content ── */}
              <div className="p-6 space-y-6 min-h-[320px] max-h-[58vh] overflow-y-auto scrollbar-thin">
                <AnimatePresence mode="wait">

                  {/* ── Audio Tab ── */}
                  {tab === "audio" && (
                    <motion.div
                      key="audio"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-6"
                    >
                      {/* Microphone */}
                      <div className="space-y-3">
                        <SectionLabel icon={<Mic className="h-3.5 w-3.5" />} label="Microphone" accent />
                        {audioInputs.length === 0
                          ? <p className="text-sm text-ah-text-muted text-center py-4">No microphones found</p>
                          : audioInputs.map(d => (
                            <DeviceRow
                              key={d.deviceId}
                              label={d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                              isSelected={selectedAudioInput === d.deviceId}
                              onClick={() => handleAudio(d.deviceId)}
                              disabled={loading}
                            />
                          ))
                        }
                        {/* Input level */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ah-text-subtle">
                            <Activity className="h-3 w-3 text-emerald-400" />
                            Input level
                          </div>
                          <LiveMicWaveform deviceId={selectedAudioInput || null} />
                        </div>
                      </div>

                      {/* Speaker */}
                      <div className="space-y-3">
                        <SectionLabel icon={<Headphones className="h-3.5 w-3.5" />} label="Speaker" />
                        {audioOutputs.length === 0
                          ? <p className="text-sm text-ah-text-muted px-1">Using system default</p>
                          : audioOutputs.map(d => (
                            <div
                              key={d.deviceId}
                              className="px-4 py-3 rounded-2xl text-[13px] bg-ah-glass border border-ah-glass-border text-ah-text-muted truncate"
                            >
                              {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                            </div>
                          ))
                        }
                        <div className="flex items-center gap-3">
                          <TestToneButton />
                          <span className="text-[11px] text-ah-text-subtle">Plays 440 Hz for 2s</span>
                        </div>
                        <p className="text-[11px] text-ah-text-subtle leading-relaxed">
                          Output device is managed by your OS settings.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Video Tab ── */}
                  {tab === "video" && (
                    <motion.div
                      key="video"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-6"
                    >
                      {/* Camera selector */}
                      <div className="space-y-3">
                        <SectionLabel icon={<Camera className="h-3.5 w-3.5" />} label="Camera" accent />
                        {videoInputs.length === 0
                          ? <p className="text-sm text-ah-text-muted text-center py-4">No cameras found</p>
                          : videoInputs.map(d => (
                            <DeviceRow
                              key={d.deviceId}
                              label={d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                              isSelected={selectedVideoInput === d.deviceId}
                              onClick={() => handleVideo(d.deviceId)}
                              disabled={loading}
                            />
                          ))
                        }
                      </div>

                      {/* Camera preview */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-widest text-ah-text-subtle font-semibold">Preview</span>
                        <CameraPreview deviceId={selectedVideoInput || null} />
                      </div>

                      {/* Quality */}
                      <div className="space-y-3">
                        <SectionLabel icon={<Volume2 className="h-3.5 w-3.5" />} label="Video Quality" />
                        <div className="grid grid-cols-2 gap-2">
                          {QUALITY_OPTIONS.map(q => (
                            <button
                              key={q.value}
                              onClick={() => onSetVideoQuality?.(q.value as "high" | "medium" | "low" | "auto")}
                              className={cn(
                                "px-3 py-3 rounded-2xl transition-all border text-left",
                                videoQuality === q.value
                                  ? "bg-violet-500/15 border-violet-400/30 text-ah-text shadow-sm shadow-violet-500/10"
                                  : "bg-ah-glass border-ah-glass-border text-ah-text-muted hover:text-ah-text hover:bg-ah-surface-raised"
                              )}
                            >
                              <div className="font-bold text-[13px]">{q.label}</div>
                              <div className="text-[10px] opacity-60 mt-0.5">{q.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Shortcuts Tab ── */}
                  {tab === "shortcuts" && (
                    <motion.div
                      key="shortcuts"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      <p className="text-[12px] text-ah-text-subtle leading-relaxed">
                        Shortcuts are disabled while typing in chat or input fields.
                      </p>
                      <div className="space-y-1.5">
                        {[
                          ...shortcuts,
                          { key: "Space", label: "Push to Talk (hold)" },
                          { key: "?",     label: "Show / hide shortcuts" },
                        ].map(s => (
                          <div
                            key={s.key}
                            className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-ah-glass border border-ah-glass-border"
                          >
                            <span className="text-[13px] text-ah-text">{s.label}</span>
                            <kbd className="px-2.5 py-1 rounded-lg bg-ah-surface-raised border border-ah-border text-[11px] font-mono font-bold text-ah-text-muted">
                              {s.key.length === 1 && s.key !== " " && s.key !== "?"
                                ? s.key.toUpperCase()
                                : s.key
                              }
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Footer ── */}
              <div className="px-6 py-4 border-t border-ah-glass-border">
                <button
                  onClick={onClose}
                  className={cn(
                    "w-full h-11 rounded-2xl text-sm font-bold text-white transition-all",
                    "bg-gradient-to-r from-violet-600 to-violet-500",
                    "hover:from-violet-500 hover:to-violet-400",
                    "shadow-md shadow-violet-500/25 hover:shadow-violet-500/40"
                  )}
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
