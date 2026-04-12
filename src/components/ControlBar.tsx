import React, { useState, useEffect, useRef } from "react";
import {
  Mic, MicOff, Monitor, MonitorOff, PhoneOff, Settings2, Volume2, Volume1, VolumeX,
  Video, VideoOff, SwitchCamera, Circle, Users, MessageSquare, Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PiPKeepAlive } from "./PiPKeepAlive";
import { RecordingControls } from "./room/RecordingControls";
import type { RecordingState } from "@/src/hooks/useRecordingAgent";
import type { PanelTab } from "@/src/hooks/webrtc/types";

interface ControlBarProps {
  isMuted: boolean;
  isSharingScreen: boolean;
  isVideoEnabled: boolean;
  onToggleMute: () => void;
  onToggleScreenShare: () => Promise<void>;
  onToggleVideo: () => Promise<void>;
  onSwitchCamera: () => Promise<void>;
  onLeave: () => void;
  onOpenDeviceSelector: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  recordingState?: RecordingState;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onDownloadRecording?: () => void;
  onClearRecording?: () => void;
  activeTab?: PanelTab;
  onToggleTab?: (tab: PanelTab) => void;
  /** Number of unread chat messages */
  unreadCount?: number;
  /** Total peer count (excluding local) */
  peerCount?: number;
}

/* ─── Active-state color map (semantic, theme-aware) ──────────────────────── */
// Uses CSS custom properties so both light and dark modes benefit
const ACTIVE_CLASSES: Record<string, string> = {
  violet:  "bg-ah-accent-subtle border-[color:var(--ah-accent)] text-[color:var(--ah-accent)] shadow-[0_0_0_1px_var(--ah-accent-glow)]",
  cyan:    "bg-[oklch(0.55_0.22_210_/_15%)] border-[oklch(0.65_0.22_210_/_60%)] text-[oklch(0.7_0.22_210)] shadow-[0_0_0_1px_oklch(0.55_0.22_210_/_20%)]",
  emerald: "bg-[oklch(0.55_0.19_160_/_15%)] border-[oklch(0.62_0.19_160_/_60%)] text-[oklch(0.7_0.19_160)] shadow-[0_0_0_1px_oklch(0.55_0.19_160_/_20%)]",
  red:     "bg-[oklch(0.54_0.22_25_/_15%)]  border-[oklch(0.6_0.22_25_/_60%)]  text-[oklch(0.68_0.22_25)]  shadow-[0_0_0_1px_oklch(0.54_0.22_25_/_20%)]",
  amber:   "bg-[oklch(0.75_0.18_85_/_15%)] border-[oklch(0.8_0.18_85_/_60%)] text-[oklch(0.7_0.18_85)] shadow-[0_0_0_1px_oklch(0.75_0.18_85_/_20%)]",
};

/* ─── Pill button ──────────────────────────────────────────────────────────── */
interface PillBtnProps {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  activeColor?: keyof typeof ACTIVE_CLASSES;
  label: string;
  kbd?: string;
  badge?: number;
  children: React.ReactNode;
  className?: string;
}

function PillBtn({
  onClick, active, danger, activeColor = "violet",
  label, kbd, badge, children, className,
}: PillBtnProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative h-11 w-11 rounded-2xl border transition-all duration-200",
            "flex items-center justify-center",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ah-accent)]/60",
            // Base — fully theme-aware
            "bg-ah-control-bg border-ah-border text-ah-text-muted",
            "hover:bg-ah-control-hover hover:border-[color:var(--ah-border-strong)] hover:text-ah-text",
            "active:scale-95",
            // Active state — theme-aware
            active && !danger && ACTIVE_CLASSES[activeColor],
            // Danger (leave button) — uses semantic danger tokens
            danger && [
              "border-[color:var(--ah-danger-bg)] text-[color:var(--ah-danger-text)]",
              "bg-[color:var(--ah-danger-bg)] shadow-md shadow-[color:var(--ah-danger-glow)]",
              "hover:bg-[color:var(--ah-danger-hover)] hover:border-[color:var(--ah-danger-hover)]",
              "h-11 w-11",
            ],
            className,
          )}
          aria-label={label}
          aria-pressed={active}
        >
          {children}

          {/* Badge */}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[color:var(--ah-accent)] rounded-full text-[9px] font-bold flex items-center justify-center text-white px-1 shadow-lg">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-ah-surface/95 border-ah-glass-border backdrop-blur-xl text-ah-text text-xs flex items-center gap-2"
      >
        {label}
        {kbd && (
          <kbd className="px-1.5 py-0.5 bg-ah-surface-raised border border-ah-border rounded text-[10px] font-mono text-ah-text-muted">
            {kbd}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Divider ──────────────────────────────────────────────────────────────── */
function Divider() {
  return <div className="h-6 w-px bg-ah-border mx-1 shrink-0" />;
}

/* ─── Inline Volume Control ────────────────────────────────────────────────── */
interface VolumeControlProps {
  volume: number;
  onVolumeChange: (v: number) => void;
}

function VolumeControl({ volume, onVolumeChange }: VolumeControlProps) {
  const [showSlider, setShowSlider] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const open = () => {
    setShowSlider(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowSlider(false), 3000);
  };

  const keep = () => {
    clearTimeout(timeoutRef.current);
    setShowSlider(true);
  };

  const close = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowSlider(false), 1200);
  };

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      className="hidden sm:flex items-center gap-1.5"
      onMouseEnter={open}
      onMouseLeave={close}
    >
      {/* Volume icon / mute toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => { onVolumeChange(volume === 0 ? 1 : 0); open(); }}
            onFocus={keep}
            onBlur={close}
            className={cn(
              "h-8 w-8 rounded-xl border flex items-center justify-center transition-all duration-200",
              "bg-ah-control-bg border-ah-border text-ah-text-muted",
              "hover:bg-ah-control-hover hover:border-[color:var(--ah-border-strong)] hover:text-ah-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ah-accent)]/60",
              "active:scale-95",
              volume === 0 && "text-[color:var(--ah-danger)] border-[color:var(--ah-danger)]/40",
            )}
            aria-label={volume === 0 ? "Unmute participants" : "Mute participants"}
          >
            <VolumeIcon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {volume === 0 ? "Unmute" : "Mute"} participants
        </TooltipContent>
      </Tooltip>

      {/* Expanding slider */}
      <AnimatePresence>
        {showSlider && (
          <motion.div
            key="vol-slider"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 88, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden flex items-center"
            onMouseEnter={keep}
            onMouseLeave={close}
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={e => onVolumeChange(parseFloat(e.target.value))}
              className="ah-slider w-full cursor-pointer"
              aria-label="Participant volume"
              style={{
                // Dynamic fill using CSS gradient trick
                background: `linear-gradient(to right,
                  var(--ah-slider-fill) 0%,
                  var(--ah-slider-fill) ${volume * 100}%,
                  var(--ah-slider-track) ${volume * 100}%,
                  var(--ah-slider-track) 100%)`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── ControlBar ───────────────────────────────────────────────────────────── */
export function ControlBar({
  isMuted,
  isSharingScreen,
  isVideoEnabled,
  onToggleMute,
  onToggleScreenShare,
  onToggleVideo,
  onSwitchCamera,
  onLeave,
  onOpenDeviceSelector,
  volume,
  onVolumeChange,
  recordingState,
  onStartRecording,
  onStopRecording,
  onDownloadRecording,
  onClearRecording,
  activeTab = null,
  onToggleTab,
  unreadCount = 0,
  peerCount = 0,
}: ControlBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const [recordingPopoverOpen, setRecordingPopoverOpen] = useState(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  /* Session timer */
  useEffect(() => {
    const id = setInterval(() => setElapsed(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    /* Floating glass pill anchored at bottom */
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.1 }}
      className={cn(
        "flex items-center justify-center gap-1.5 sm:gap-2",
        "px-3 py-2.5 sm:px-4",
        "rounded-2xl sm:rounded-[22px]",
        "bg-ah-glass backdrop-blur-2xl border border-ah-glass-border",
        "shadow-[var(--ah-control-shadow)]",
        /* Full-width on tiny screens, auto on large */
        "w-full max-w-none sm:w-auto sm:max-w-fit sm:mx-auto",
      )}
    >
      {/* ── Session timer (md+) ── */}
      <div className="hidden md:flex items-center gap-2 mr-1">
        <motion.div
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
        />
        <span className="text-[11px] font-mono text-ah-text-muted tabular-nums">
          {formatTime(elapsed)}
        </span>
      </div>

      <Divider />

      {/* ── Group 1: Mic + Video ── */}
      <PillBtn
        onClick={onToggleMute}
        active={!isMuted}
        activeColor="emerald"
        label={isMuted ? "Unmute" : "Mute"}
        kbd="M"
      >
        {isMuted
          ? <MicOff className="h-[18px] w-[18px]" />
          : <Mic className="h-[18px] w-[18px]" />
        }
      </PillBtn>

      <PillBtn
        onClick={onToggleVideo}
        active={isVideoEnabled}
        activeColor="violet"
        label={isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
        kbd="V"
      >
        {isVideoEnabled
          ? <Video className="h-[18px] w-[18px]" />
          : <VideoOff className="h-[18px] w-[18px]" />
        }
      </PillBtn>

      {/* Camera switch — only when video is on */}
      <AnimatePresence>
        {isVideoEnabled && (
          <motion.div
            key="cam-switch"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 44, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <PillBtn onClick={onSwitchCamera} label="Switch Camera">
              <SwitchCamera className="h-[18px] w-[18px]" />
            </PillBtn>
          </motion.div>
        )}
      </AnimatePresence>

      <Divider />

      {/* ── Group 2: Screen share ── */}
      {!isMobile && (
        <PillBtn
          onClick={onToggleScreenShare}
          active={isSharingScreen}
          activeColor="cyan"
          label={isSharingScreen ? "Stop Sharing" : "Share Screen"}
          kbd="S"
        >
          {isSharingScreen
            ? <MonitorOff className="h-[18px] w-[18px]" />
            : <Monitor className="h-[18px] w-[18px]" />
          }
        </PillBtn>
      )}

      <Divider />

      {/* ── Group 3: Panels ── */}
      {onToggleTab && (
        <>
          <PillBtn
            onClick={() => onToggleTab("participants")}
            active={activeTab === "participants"}
            activeColor="violet"
            label="Participants"
            badge={peerCount + 1}
          >
            <Users className="h-[18px] w-[18px]" />
          </PillBtn>

          <PillBtn
            onClick={() => onToggleTab("chat")}
            active={activeTab === "chat"}
            activeColor="violet"
            label="Chat"
            kbd="C"
            badge={unreadCount}
          >
            <MessageSquare className="h-[18px] w-[18px]" />
          </PillBtn>

          <PillBtn
            onClick={() => onToggleTab("activity")}
            active={activeTab === "activity"}
            activeColor="amber"
            label="Activity"
          >
            <Activity className="h-[18px] w-[18px]" />
          </PillBtn>
        </>
      )}

      {/* Recording */}
      {recordingState && (
        <div className="relative">
          <PillBtn
            onClick={() => setRecordingPopoverOpen(p => !p)}
            active={recordingState.isRecording}
            activeColor="red"
            label={recordingState.isRecording ? "Recording…" : recordingState.blob ? "Download" : "Record"}
          >
            <motion.div
              animate={recordingState.isRecording ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Circle className={cn(
                "h-[18px] w-[18px]",
                recordingState.isRecording ? "fill-[oklch(0.68_0.22_25)] text-[oklch(0.68_0.22_25)]" : "text-ah-text-muted"
              )} />
            </motion.div>
          </PillBtn>

          <RecordingControls
            state={recordingState}
            isOpen={recordingPopoverOpen}
            onClose={() => setRecordingPopoverOpen(false)}
            onStart={() => { onStartRecording?.(); setRecordingPopoverOpen(false); }}
            onStop={() => onStopRecording?.()}
            onDownload={() => onDownloadRecording?.()}
            onClear={() => onClearRecording?.()}
          />
        </div>
      )}

      {/* Settings */}
      <PillBtn onClick={onOpenDeviceSelector} label="Settings">
        <Settings2 className="h-[18px] w-[18px]" />
      </PillBtn>

      <PiPKeepAlive isMuted={isMuted} onToggleMute={onToggleMute} />

      <Divider />

      {/* ── Volume (inline, desktop only) ── */}
      <VolumeControl volume={volume} onVolumeChange={onVolumeChange} />

      <Divider />

      {/* ── Leave ── */}
      <PillBtn onClick={onLeave} danger label="Leave Room" kbd="⌥Q">
        <PhoneOff className="h-[18px] w-[18px]" />
      </PillBtn>
    </motion.div>
  );
}
