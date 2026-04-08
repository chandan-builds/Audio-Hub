import { useState, useEffect } from "react";
import {
  Mic, MicOff, Monitor, MonitorOff, PhoneOff, Settings2, Volume2
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ControlBarProps {
  isMuted: boolean;
  isSharingScreen: boolean;
  onToggleMute: () => void;
  onToggleScreenShare: () => Promise<void>;
  onLeave: () => void;
  onOpenDeviceSelector: () => void;
}

export function ControlBar({
  isMuted,
  isSharingScreen,
  onToggleMute,
  onToggleScreenShare,
  onLeave,
  onOpenDeviceSelector,
}: ControlBarProps) {
  const [time, setTime] = useState(0);

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
      className="h-20 border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur-2xl flex items-center justify-center gap-3 px-6 relative"
    >
      {/* Call duration */}
      <div className="absolute left-6 hidden sm:flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-mono text-zinc-500">{formatTime(time)}</span>
      </div>

      {/* Controls */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleMute}
            className={cn(
              "h-12 w-12 rounded-full border-zinc-800/60 bg-zinc-900/60 hover:bg-zinc-800 transition-all duration-200",
              isMuted && "bg-red-950/30 border-red-900/50 text-red-400 hover:bg-red-950/50"
            )}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300">
          {isMuted ? "Unmute" : "Mute"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleScreenShare}
            className={cn(
              "h-12 w-12 rounded-full border-zinc-800/60 bg-zinc-900/60 hover:bg-zinc-800 transition-all duration-200",
              isSharingScreen && "bg-cyan-950/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-950/50"
            )}
          >
            {isSharingScreen ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300">
          {isSharingScreen ? "Stop Sharing" : "Share Screen"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenDeviceSelector}
            className="h-12 w-12 rounded-full border-zinc-800/60 bg-zinc-900/60 hover:bg-zinc-800 transition-all duration-200"
          >
             <Settings2 className="h-5 w-5 text-zinc-400" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300">
          Audio Settings
        </TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-8 bg-zinc-800/60 mx-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="destructive"
            size="icon"
            onClick={onLeave}
            className="h-12 w-12 rounded-full bg-red-600/80 hover:bg-red-600 shadow-lg shadow-red-900/20 transition-all duration-200 active:scale-95"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300">
          Leave Room
        </TooltipContent>
      </Tooltip>

      {/* Volume indicator */}
      <div className="absolute right-6 hidden sm:flex items-center gap-2">
        <Volume2 className="h-3.5 w-3.5 text-zinc-600" />
        <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full w-4/5 bg-zinc-600 rounded-full" />
        </div>
      </div>
    </motion.div>
  );
}
