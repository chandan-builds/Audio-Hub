// src/components/room/ControlBar.tsx
import { useState, useEffect } from "react";
import {
  Mic, MicOff, Monitor, MonitorOff, PhoneOff, Settings2, Volume2
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none w-full max-w-2xl px-4 hidden md:flex justify-center">
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="h-16 px-6 rounded-full bg-[#18181b]/90 backdrop-blur-3xl border border-zinc-700/60 shadow-2xl shadow-black/80 flex items-center justify-between gap-4 pointer-events-auto"
      >
        {/* Call duration */}
        <div className="flex items-center gap-2 pr-2 border-r border-zinc-800/80">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          <span className="text-sm font-mono text-zinc-300 w-12 text-center">{formatTime(time)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleMute}
                className={cn(
                  "h-12 w-12 rounded-full border-zinc-700/50 bg-[#27272a]/60 hover:bg-zinc-700 transition-all duration-200",
                  isMuted && "bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30"
                )}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300 mb-2">
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
                  "h-12 w-12 rounded-full border-zinc-700/50 bg-[#27272a]/60 hover:bg-zinc-700 transition-all duration-200",
                  isSharingScreen && "bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30"
                )}
              >
                {isSharingScreen ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300 mb-2">
              {isSharingScreen ? "Stop Sharing" : "Share Screen"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenDeviceSelector}
                className="h-12 w-12 rounded-full border-zinc-700/50 bg-[#27272a]/60 hover:bg-zinc-700 transition-all duration-200"
              >
                <Settings2 className="h-5 w-5 text-zinc-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300 mb-2">
              Audio Settings
            </TooltipContent>
          </Tooltip>

          <PiPKeepAlive />
        </div>

        <Separator orientation="vertical" className="h-8 bg-zinc-800/80 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              onClick={onLeave}
              className="h-12 w-12 rounded-full bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/40 transition-all duration-200 active:scale-95"
            >
              <PhoneOff className="h-5 w-5 text-white" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300 mb-2">
            Leave Room
          </TooltipContent>
        </Tooltip>
      </motion.div>
      
      {/* Mobile controls bar fallback if needed, but modern CSS approaches handles this */}
    </div>
  );
}
