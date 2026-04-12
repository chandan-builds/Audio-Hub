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
      <TooltipContent className="bg-ah-surface border-ah-border text-ah-text">
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
    <span className="text-[11px] font-mono text-ah-text-muted tabular-nums hidden sm:inline">
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
    <header className="h-14 border-b border-ah-border bg-ah-header-bg backdrop-blur-xl flex items-center justify-between px-4 sm:px-5 z-10 transition-colors duration-300">
      {/* ── Left: Logo + Room ID ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <Radio className="h-4 w-4 text-violet-500" />
          <h1 className="font-bold tracking-tight text-ah-text text-sm hidden sm:block">Audio Hub</h1>
        </div>

        <Separator orientation="vertical" className="h-4 bg-ah-border hidden sm:block" />

        <div className="flex items-center gap-1.5 min-w-0">
          <Badge
            variant="outline"
            className="bg-ah-surface-raised border-ah-border text-ah-text-muted font-mono text-[11px] truncate max-w-[80px] sm:max-w-none"
          >
            {roomId}
          </Badge>

          <Tooltip>
            <TooltipTrigger
              id="topbar-copy-link"
              onClick={handleCopy}
              aria-label="Copy invite link"
              className="p-1 hover:bg-ah-control-hover rounded-md transition-colors shrink-0"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.div key="check" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  </motion.div>
                ) : (
                  <motion.div key="copy" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                    <Copy className="h-3.5 w-3.5 text-ah-text-muted" />
                  </motion.div>
                )}
              </AnimatePresence>
            </TooltipTrigger>
            <TooltipContent className="bg-ah-surface border-ah-border text-ah-text">
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
            <TooltipTrigger render={<Avatar className="h-7 w-7 border-2 border-ah-surface cursor-default" />}>
              <AvatarFallback className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-[10px] font-bold">
                {userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </TooltipTrigger>
            <TooltipContent className="bg-ah-surface border-ah-border text-ah-text">
              {userName} (You)
            </TooltipContent>
          </Tooltip>

          {peerArray.slice(0, 3).map(([id, peer]) => (
            <React.Fragment key={id}>
              <Tooltip>
                <TooltipTrigger render={<Avatar className="h-7 w-7 border-2 border-ah-surface cursor-default" />}>
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-medium",
                      peer.connectionState === "connected"
                        ? "bg-ah-surface-raised text-ah-text-muted"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {peer.userName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </TooltipTrigger>
                <TooltipContent className="bg-ah-surface border-ah-border text-ah-text">
                  {peer.userName}
                </TooltipContent>
              </Tooltip>
            </React.Fragment>
          ))}

          {peerArray.length > 3 && (
            <Avatar className="h-7 w-7 border-2 border-ah-surface">
              <AvatarFallback className="bg-ah-surface-raised text-[10px] text-ah-text-muted">
                +{peerArray.length - 3}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        <Badge className="bg-ah-surface-raised text-ah-text-muted border-ah-border text-[10px] font-mono gap-1 hidden sm:flex">
          <Users className="h-3 w-3" />
          {roomUserCount}
        </Badge>

        <ThemeToggle isCompact />

        {/* Secondary Leave — only on very wide screens; visually subdued since ControlBar has the primary action */}
        <Button
          id="topbar-leave"
          variant="ghost"
          onClick={onLeave}
          size="sm"
          className={cn(
            "h-8 text-xs font-medium hidden xl:flex gap-1.5",
            "text-ah-text-muted border border-ah-border",
            "hover:text-[color:var(--ah-danger)] hover:border-[color:var(--ah-danger)]/50 hover:bg-[color:var(--ah-danger-glow)]",
            "transition-all duration-200",
          )}
          aria-label="Leave room (secondary)"
        >
          <LogOut className="h-3.5 w-3.5" />
          Leave
        </Button>
      </div>
    </header>
  );
}
