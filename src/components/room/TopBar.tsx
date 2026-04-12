import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Radio, Copy, Check, Users, Wifi, WifiOff, AlertTriangle,
  LogOut, SwitchCamera as SwitchCameraIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { cn } from "@/lib/utils";
import type { PeerData } from "@/src/hooks/useWebRTC";

/* ─── Connection quality badge ──────────────────────────────────────── */
function ConnectionBadge({ isConnected, peerCount }: { isConnected: boolean; peerCount: number }) {
  // Derive worst-case quality from RTCIceConnectionState aggregated in parent
  const label  = isConnected ? (peerCount === 0 ? "Waiting" : "Connected") : "Reconnecting";
  const color  = isConnected ? "text-emerald-500 border-emerald-900/30 bg-emerald-950/10 dark:bg-emerald-950/20"
                             : "text-amber-500 border-amber-900/30 bg-amber-950/10 dark:bg-amber-950/20 animate-pulse";
  const Icon   = isConnected ? Wifi : AlertTriangle;

  return (
    <Tooltip>
      <TooltipTrigger className={cn("inline-flex items-center rounded-md border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", "border-border", "gap-1 text-[10px] cursor-default", color)}>
        <Icon className="h-3 w-3" />
        {label}
      </TooltipTrigger>
      <TooltipContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
        {isConnected ? "Signaling connected" : "Trying to reconnect…"}
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Call timer ─────────────────────────────────────────────────────── */
function CallTimer() {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums hidden sm:inline">
      {mm}:{ss}
    </span>
  );
}

/* ─── Props ──────────────────────────────────────────────────────────── */
interface TopBarProps {
  roomId:      string;
  userName:    string;
  peers:       Map<string, PeerData>;
  isConnected: boolean;
  roomUserCount: number;
  isVideoEnabled: boolean;
  isRecording?: boolean;
  chatOpen:    boolean;
  onToggleChat: () => void;
  onLeave:     () => void;
}

export function TopBar({
  roomId,
  userName,
  peers,
  isConnected,
  roomUserCount,
  isVideoEnabled,
  isRecording = false,
  chatOpen,
  onToggleChat,
  onLeave,
}: TopBarProps) {
  const [copied, setCopied] = useState(false);
  const peerArray = useMemo(() => Array.from(peers.entries()), [peers]);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/60 backdrop-blur-xl flex items-center justify-between px-4 sm:px-5 z-10 transition-colors duration-300">
      {/* ── Left: Logo + Room ID ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <Radio className="h-4 w-4 text-violet-500" />
          <h1 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-200 text-sm hidden sm:block">Audio Hub</h1>
        </div>

        <Separator orientation="vertical" className="h-4 bg-zinc-200 dark:bg-zinc-800/60 hidden sm:block" />

        <div className="flex items-center gap-1.5 min-w-0">
          <Badge
            variant="outline"
            className="bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800/60 text-zinc-600 dark:text-zinc-400 font-mono text-[11px] truncate max-w-[80px] sm:max-w-none"
          >
            {roomId}
          </Badge>

          <Tooltip>
            <TooltipTrigger
              id="topbar-copy-link"
              onClick={handleCopy}
              aria-label="Copy invite link"
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors shrink-0"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.div key="check" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  </motion.div>
                ) : (
                  <motion.div key="copy" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                    <Copy className="h-3.5 w-3.5 text-zinc-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
              Copy invite link
            </TooltipContent>
          </Tooltip>
        </div>

        <ConnectionBadge isConnected={isConnected} peerCount={peerArray.length} />

        {/* Recording indicator */}
        {isRecording && (
          <Badge variant="outline" className="gap-1 text-[10px] text-red-400 border-red-900/30 bg-red-950/20 hidden sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            REC
          </Badge>
        )}
      </div>

      {/* ── Right: Avatars + Badge + Controls ── */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <CallTimer />

        {/* Avatar stack */}
        <div className="flex -space-x-2">
          <Tooltip>
            {/* Base UI TooltipTrigger render prop to change element */}
            <TooltipTrigger render={<Avatar className="h-7 w-7 border-2 border-white dark:border-zinc-950 cursor-default" />}>
              <AvatarFallback className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-[10px] font-bold">
                {userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
              {userName} (You)
            </TooltipContent>
          </Tooltip>

          {peerArray.slice(0, 3).map(([id, peer]) => (
            <React.Fragment key={id}>
              <Tooltip>
                <TooltipTrigger render={<Avatar className="h-7 w-7 border-2 border-white dark:border-zinc-950 cursor-default" />}>
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-medium",
                      peer.connectionState === "connected"
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {peer.userName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
                  {peer.userName}
                </TooltipContent>
              </Tooltip>
            </React.Fragment>
          ))}

          {peerArray.length > 3 && (
            <Avatar className="h-7 w-7 border-2 border-white dark:border-zinc-950">
              <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500">
                +{peerArray.length - 3}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        <Badge className="bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/40 text-[10px] font-mono gap-1 hidden sm:flex">
          <Users className="h-3 w-3" />
          {roomUserCount}
        </Badge>

        <ThemeToggle isCompact />

        <Button
          id="topbar-leave"
          variant="destructive"
          onClick={onLeave}
          size="sm"
          className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/40 h-8 text-xs font-semibold hidden xl:flex"
        >
          <LogOut className="h-3.5 w-3.5 mr-1.5" />
          Leave
        </Button>
      </div>
    </header>
  );
}
