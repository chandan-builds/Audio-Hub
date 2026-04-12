import { useState, useEffect } from "react";
import {
  Mic, MicOff, Monitor, MonitorOff, PhoneOff, Settings2, Volume2, Volume1, VolumeX,
  Video, VideoOff, SwitchCamera, Circle
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PiPKeepAlive } from "./PiPKeepAlive";
import { RecordingControls } from "./room/RecordingControls";
import type { RecordingState } from "@/src/hooks/useRecordingAgent";

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
  /** Recording state from useRecordingAgent */
  recordingState?: RecordingState;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onDownloadRecording?: () => void;
  onClearRecording?: () => void;
}

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
}: ControlBarProps) {
  const [time, setTime] = useState(0);
  const [recordingPopoverOpen, setRecordingPopoverOpen] = useState(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  useEffect(() => {
    const interval = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="relative flex h-20 items-center justify-center gap-3 border-t border-ah-border bg-ah-control-bg px-6 backdrop-blur-2xl"
    >
      {/* Call duration */}
      <div className="absolute left-6 hidden sm:flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-mono text-ah-text-muted">{formatTime(time)}</span>
      </div>

      {/* ── Group 1: Media Controls ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleMute}
            className={cn(
              "h-12 w-12 rounded-full border-ah-border bg-ah-surface text-ah-text-muted transition-all duration-200 hover:bg-ah-control-hover hover:text-ah-text",
              isMuted && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50",
              !isMuted && "shadow-[0_0_12px_rgba(16,185,129,0.15)] dark:shadow-[0_0_12px_rgba(16,185,129,0.1)]"
            )}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="border-ah-border bg-ah-surface text-ah-text">
          <span>{isMuted ? "Unmute" : "Mute"}</span>
          <kbd className="ml-2 rounded bg-ah-surface-raised px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ah-text-muted">M</kbd>
        </TooltipContent>
      </Tooltip>

      {/* Video Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleVideo}
            className={cn(
              "h-12 w-12 rounded-full border-ah-border bg-ah-surface text-ah-text-muted transition-all duration-200 hover:bg-ah-control-hover hover:text-ah-text",
              isVideoEnabled && "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-700/50 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/50 shadow-[0_0_12px_rgba(139,92,246,0.15)] dark:shadow-[0_0_12px_rgba(139,92,246,0.1)]"
            )}
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="border-ah-border bg-ah-surface text-ah-text">
          <span>{isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}</span>
          <kbd className="ml-2 rounded bg-ah-surface-raised px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ah-text-muted">V</kbd>
        </TooltipContent>
      </Tooltip>

      {/* Camera Switch */}
      {isVideoEnabled && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onSwitchCamera}
              className="h-12 w-12 rounded-full border-ah-border bg-ah-surface text-ah-text-muted transition-all duration-200 hover:bg-ah-control-hover hover:text-ah-text"
            >
              <SwitchCamera className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="border-ah-border bg-ah-surface text-ah-text">
            Switch Camera
          </TooltipContent>
        </Tooltip>
      )}

      <Separator orientation="vertical" className="mx-0.5 h-8 bg-ah-border" />

      {/* ── Group 2: Collaboration ── */}
      {!isMobile && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleScreenShare}
              className={cn(
                "h-12 w-12 rounded-full border-ah-border bg-ah-surface text-ah-text-muted transition-all duration-200 hover:bg-ah-control-hover hover:text-ah-text",
                isSharingScreen && "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-700/50 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-950/50 shadow-[0_0_12px_rgba(6,182,212,0.15)] dark:shadow-[0_0_12px_rgba(6,182,212,0.1)]"
              )}
            >
              {isSharingScreen ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="border-ah-border bg-ah-surface text-ah-text">
            <span>{isSharingScreen ? "Stop Sharing" : "Share Screen"}</span>
            <kbd className="ml-2 rounded bg-ah-surface-raised px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ah-text-muted">S</kbd>
          </TooltipContent>
        </Tooltip>
      )}

      <Separator orientation="vertical" className="mx-0.5 h-8 bg-ah-border" />

      {/* ── Group 3: Settings + Recording ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenDeviceSelector}
            className="h-12 w-12 rounded-full border-ah-border bg-ah-surface text-ah-text-muted transition-all duration-200 hover:bg-ah-control-hover hover:text-ah-text"
          >
             <Settings2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="border-ah-border bg-ah-surface text-ah-text">
          Settings
        </TooltipContent>
      </Tooltip>

      {/* Recording button */}
      {recordingState && (
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setRecordingPopoverOpen((p) => !p)}
                className={cn(
                  "h-12 w-12 rounded-full border-ah-border bg-ah-surface text-ah-text-muted transition-all duration-200 hover:bg-ah-control-hover hover:text-ah-text",
                  recordingState.isRecording && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.2)] dark:shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                )}
              >
                <Circle className={cn("h-5 w-5", recordingState.isRecording ? "text-red-500 fill-red-500 animate-pulse" : "text-ah-text-muted")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="border-ah-border bg-ah-surface text-ah-text">
              {recordingState.isRecording ? "Recording…" : recordingState.blob ? "Download Recording" : "Record"}
            </TooltipContent>
          </Tooltip>

          {/* Recording popover */}
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

      <PiPKeepAlive isMuted={isMuted} onToggleMute={onToggleMute} />

      <Separator orientation="vertical" className="mx-1 h-8 bg-ah-border" />

      {/* ── Group 4: Leave ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="destructive"
            size="icon"
            onClick={onLeave}
            className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600 dark:bg-red-600/80 dark:hover:bg-red-600 shadow-lg shadow-red-900/10 dark:shadow-red-900/20 text-white transition-all duration-200 active:scale-95"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="border-ah-border bg-ah-surface text-ah-text">
          Leave Room
        </TooltipContent>
      </Tooltip>

      {/* Volume Control */}
      <div className="absolute right-6 hidden sm:flex items-center gap-2 group">
        <button 
          onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
          className="text-ah-text-faint transition-colors hover:text-ah-text-muted focus:outline-none"
        >
          {volume === 0 ? <VolumeX className="h-4 w-4" /> : volume < 0.5 ? <Volume1 className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input 
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-ah-border accent-violet-500 transition-all hover:accent-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:accent-violet-400"
        />
      </div>
    </motion.div>
  );
}
