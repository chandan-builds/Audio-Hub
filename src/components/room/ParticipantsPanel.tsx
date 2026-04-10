import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic, MicOff, Video, VideoOff, Wifi, WifiOff, AlertTriangle,
  Crown, UserRound, Volume2, VolumeX, ShieldOff,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { PeerData } from "@/src/hooks/useWebRTC";

/* ─── Connection quality icon ───────────────────────────── */
function ConnectionIcon({ state }: { state: RTCIceConnectionState }) {
  if (state === "connected" || state === "completed")
    return <Wifi className="h-3 w-3 text-emerald-500" />;
  if (state === "disconnected" || state === "failed")
    return <WifiOff className="h-3 w-3 text-red-400" />;
  return <AlertTriangle className="h-3 w-3 text-amber-400 animate-pulse" />;
}

/* ─── Speaking waveform ─────────────────────────────────── */
function SpeakingWave() {
  return (
    <div className="flex gap-[2px] items-end h-3.5 shrink-0">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ height: [3, 10 + i * 3, 3] }}
          transition={{ duration: 0.38 + i * 0.07, repeat: Infinity, ease: "easeInOut" }}
          className="w-[2px] bg-emerald-400 rounded-full"
        />
      ))}
    </div>
  );
}

/* ─── Per-participant row ───────────────────────────────── */
interface ParticipantRowProps {
  userId:     string;
  userName:   string;
  isLocal:    boolean;
  isHost:     boolean;
  isMuted:    boolean;
  isVideoEnabled: boolean;
  isSpeaking: boolean;
  connectionState: RTCIceConnectionState;
  localUserRole?: "host" | "participant";
  onMuteToggle?:   () => void;
  onVideoToggle?:  () => void;
  onKick?:         () => void;
}

function ParticipantRow({
  userId, userName, isLocal, isHost, isMuted, isVideoEnabled,
  isSpeaking, connectionState, localUserRole,
  onMuteToggle, onVideoToggle, onKick,
}: ParticipantRowProps) {
  const initials = userName.substring(0, 2).toUpperCase();
  const isLocalHost = localUserRole === "host";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={cn(
        "flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors",
        "hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40",
        isSpeaking && "bg-emerald-50/60 dark:bg-emerald-950/20"
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar className={cn(
          "h-8 w-8 border-2 transition-colors",
          isSpeaking
            ? "border-emerald-400 shadow-sm shadow-emerald-400/30"
            : "border-transparent"
        )}>
          <AvatarFallback className={cn(
            "text-[11px] font-bold",
            isLocal
              ? "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
          )}>
            {initials}
          </AvatarFallback>
        </Avatar>
        {isHost && (
          <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5">
            <Crown className="h-2 w-2 text-amber-900" />
          </div>
        )}
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isSpeaking && <SpeakingWave />}
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {userName}
          </span>
          {isLocal && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-violet-400/40 text-violet-500 shrink-0">
              You
            </Badge>
          )}
          {isHost && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400/40 text-amber-500 shrink-0">
              Host
            </Badge>
          )}
        </div>
      </div>

      {/* Status icons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ConnectionIcon state={connectionState} />

        {isMuted
          ? <MicOff className="h-3.5 w-3.5 text-red-400" />
          : <Mic className="h-3.5 w-3.5 text-emerald-500" />
        }

        {isVideoEnabled
          ? <Video className="h-3.5 w-3.5 text-violet-500" />
          : <VideoOff className="h-3.5 w-3.5 text-zinc-400" />
        }
      </div>

      {/* Host quick actions */}
      {isLocalHost && !isLocal && (
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onMuteToggle}
                aria-label={isMuted ? "Unmute participant" : "Mute participant"}
                className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                {isMuted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 border-zinc-700 text-zinc-200 text-[11px]">
              {isMuted ? "Allow unmute" : "Mute"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onKick}
                aria-label="Remove participant"
                className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors text-zinc-400 hover:text-red-500"
              >
                <ShieldOff className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 border-zinc-700 text-zinc-200 text-[11px]">
              Remove from room
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Props ─────────────────────────────────────────────── */
interface ParticipantsPanelProps {
  peers:          Map<string, PeerData>;
  localUserId:    string;
  localUserName:  string;
  localIsMuted:   boolean;
  localIsVideo:   boolean;
  userRole:       "host" | "participant";
  onHostAction:   (action: string, targetUserId: string) => void;
}

export function ParticipantsPanel({
  peers, localUserId, localUserName,
  localIsMuted, localIsVideo, userRole, onHostAction,
}: ParticipantsPanelProps) {
  const peerArray = useMemo(() => Array.from(peers.entries()), [peers]);
  const total     = peerArray.length + 1; // +1 for local

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Participants</span>
          <Badge className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/40 text-[10px] font-mono">
            {total}
          </Badge>
        </div>

        {/* Mute all (host only) */}
        {userRole === "host" && peerArray.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => peerArray.forEach(([id]) => onHostAction("mute", id))}
                className="h-7 text-[11px] border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <VolumeX className="h-3 w-3 mr-1" />
                Mute All
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700 text-zinc-200 text-[11px]">
              Mute all participants
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* In this call label */}
        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
          In this call ({total})
        </p>

        {/* Local user (always first) */}
        <ParticipantRow
          userId={localUserId}
          userName={localUserName}
          isLocal
          isHost={userRole === "host"}
          isMuted={localIsMuted}
          isVideoEnabled={localIsVideo}
          isSpeaking={false}
          connectionState="connected"
          localUserRole={userRole}
        />

        <Separator className="my-1 bg-zinc-100 dark:bg-zinc-800/60" />

        {/* Remote peers */}
        <AnimatePresence initial={false}>
          {peerArray.map(([id, peer]) => (
            <div key={id}>
              <ParticipantRow
                userId={id}
                userName={peer.userName}
                isLocal={false}
                isHost={peer.role === "host"}
                isMuted={peer.isMuted}
                isVideoEnabled={peer.isVideoEnabled}
                isSpeaking={peer.isSpeaking}
                connectionState={peer.connectionState}
                localUserRole={userRole}
                onMuteToggle={() => onHostAction("mute", id)}
                onKick={() => onHostAction("kick", id)}
              />
            </div>
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {peerArray.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 opacity-40">
            <UserRound className="h-8 w-8 mb-2 text-zinc-500" />
            <p className="text-xs text-zinc-500">Waiting for others to join…</p>
          </div>
        )}
      </div>
    </div>
  );
}
