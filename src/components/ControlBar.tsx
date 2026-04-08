import { useState, useEffect } from "react";
import {
  Mic, MicOff, Monitor, MonitorOff, PhoneOff, Settings2, Volume2, Volume1, VolumeX,
  Video, VideoOff, SwitchCamera
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PiPKeepAlive } from "./PiPKeepAlive";

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
}: ControlBarProps) {
  const [time, setTime] = useState(0);
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
      className="h-20 border-t border-zinc-200 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl flex items-center justify-center gap-3 px-6 relative"
    >
      {/* Call duration */}
      <div className="absolute left-6 hidden sm:flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{formatTime(time)}</span>
      </div>

      {/* Controls */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleMute}
            className={cn(
              "h-12 w-12 rounded-full border-zinc-200 dark:border-zinc-800/60 bg-zinc-100 dark:bg-zinc-900/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-200 text-zinc-700 dark:text-zinc-300",
              isMuted && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50"
            )}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
          {isMuted ? "Unmute" : "Mute"}
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
              "h-12 w-12 rounded-full border-zinc-200 dark:border-zinc-800/60 bg-zinc-100 dark:bg-zinc-900/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-200 text-zinc-700 dark:text-zinc-300",
              isVideoEnabled && "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-700/50 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/50"
            )}
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
          {isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
        </TooltipContent>
      </Tooltip>

      {/* Camera Switch (only when video is on & on mobile or multiple cameras) */}
      {isVideoEnabled && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onSwitchCamera}
              className="h-12 w-12 rounded-full border-zinc-200 dark:border-zinc-800/60 bg-zinc-100 dark:bg-zinc-900/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-200 text-zinc-700 dark:text-zinc-300"
            >
              <SwitchCamera className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
            Switch Camera
          </TooltipContent>
        </Tooltip>
      )}

      {!isMobile && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleScreenShare}
              className={cn(
                "h-12 w-12 rounded-full border-zinc-200 dark:border-zinc-800/60 bg-zinc-100 dark:bg-zinc-900/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-200 text-zinc-700 dark:text-zinc-300",
                isSharingScreen && "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-700/50 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-950/50"
              )}
            >
              {isSharingScreen ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
            {isSharingScreen ? "Stop Sharing" : "Share Screen"}
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenDeviceSelector}
            className="h-12 w-12 rounded-full border-zinc-200 dark:border-zinc-800/60 bg-zinc-100 dark:bg-zinc-900/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-200"
          >
             <Settings2 className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
          Audio Settings
        </TooltipContent>
      </Tooltip>

      <PiPKeepAlive isMuted={isMuted} onToggleMute={onToggleMute} />

      <Separator orientation="vertical" className="h-8 bg-zinc-200 dark:bg-zinc-800/60 mx-1" />

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
        <TooltipContent side="top" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
          Leave Room
        </TooltipContent>
      </Tooltip>

      {/* Volume Control */}
      <div className="absolute right-6 hidden sm:flex items-center gap-2 group">
        <button 
          onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
          className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors focus:outline-none"
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
          className="w-20 h-1.5 appearance-none bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-pointer accent-violet-500 hover:accent-violet-600 dark:accent-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
        />
      </div>
    </motion.div>
  );
}
