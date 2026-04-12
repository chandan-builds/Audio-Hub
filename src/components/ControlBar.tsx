import { useState, useEffect, useRef } from "react";
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

/* ─── Pill button ──────────────────────────────────────────────────────────── */
interface PillBtnProps {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  activeColor?: "violet" | "cyan" | "emerald" | "red" | "amber";
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
  const activeColorMap: Record<string, string> = {
    violet: "bg-violet-500/20 border-violet-400/50 text-violet-300 shadow-violet-500/15",
    cyan:   "bg-cyan-500/20   border-cyan-400/50   text-cyan-300   shadow-cyan-500/15",
    emerald:"bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-emerald-500/15",
    red:    "bg-red-500/20   border-red-400/50   text-red-300   shadow-red-500/20",
    amber:  "bg-amber-500/20   border-amber-400/50   text-amber-300   shadow-amber-500/15",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative h-11 w-11 rounded-2xl border transition-all duration-200",
            "flex items-center justify-center",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ah-accent/60",
            // Base — adapts to theme
            "bg-ah-control-bg border-ah-border text-ah-text-muted",
            "hover:bg-ah-control-hover hover:border-ah-border-strong hover:text-ah-text",
            "active:scale-95",
            // Active state
            active && !danger && activeColorMap[activeColor] + " shadow-md",
            // Danger (leave button)
            danger && "bg-red-500 border-red-400 text-white hover:bg-red-600 hover:border-red-500 shadow-md shadow-red-500/30 h-11 w-11",
            className,
          )}
          aria-label={label}
          aria-pressed={active}
        >
          {children}

          {/* Badge */}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-violet-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white px-1 shadow-lg">
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
  const [showVolume, setShowVolume] = useState(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const volumeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

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

  const showVolumeSlider = () => {
    setShowVolume(true);
    clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolume(false), 3000);
  };

  return (
    /* Floating glass pill anchored at bottom */
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.1 }}
      className={cn(
        "relative flex items-center justify-center gap-1.5 sm:gap-2",
        "px-4 py-2.5",
        "rounded-2xl sm:rounded-[22px]",
        "bg-ah-glass backdrop-blur-2xl border border-ah-glass-border",
        "shadow-2xl shadow-black/40",
        /* Full-width on tiny screens, auto on large */
        "w-full max-w-none sm:w-auto sm:max-w-fit sm:mx-auto",
      )}
    >
      {/* ── Left info: timer ── */}
      <div className="absolute left-4 hidden md:flex items-center gap-2">
        <motion.div
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
        />
        <span className="text-[11px] font-mono text-ah-text-muted tabular-nums">
          {formatTime(elapsed)}
        </span>
      </div>

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
                recordingState.isRecording ? "fill-red-400 text-red-400" : "text-ah-text-muted"
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

      {/* ── Leave ── */}
      <PillBtn onClick={onLeave} danger label="Leave Room" kbd="⌥Q">
        <PhoneOff className="h-[18px] w-[18px]" />
      </PillBtn>

      {/* ── Right: volume ── */}
      <div
        className="absolute right-4 hidden lg:flex items-center gap-2"
        onMouseEnter={showVolumeSlider}
        onMouseLeave={() => {
          clearTimeout(volumeTimeoutRef.current);
          volumeTimeoutRef.current = setTimeout(() => setShowVolume(false), 1200);
        }}
      >
        <button
          onClick={() => { onVolumeChange(volume === 0 ? 1 : 0); showVolumeSlider(); }}
          className="text-ah-text-muted hover:text-ah-text transition-colors"
          aria-label="Toggle mute volume"
        >
          {volume === 0
            ? <VolumeX className="h-4 w-4" />
            : volume < 0.5
            ? <Volume1 className="h-4 w-4" />
            : <Volume2 className="h-4 w-4" />
          }
        </button>

        <AnimatePresence>
          {showVolume && (
            <motion.input
              key="vol-slider"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 80, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={e => onVolumeChange(parseFloat(e.target.value))}
              className="h-1 cursor-pointer appearance-none rounded-full accent-violet-500 focus:outline-none"
              style={{ width: 80 }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
