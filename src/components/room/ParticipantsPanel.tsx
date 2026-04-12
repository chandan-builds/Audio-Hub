import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic, MicOff, Video, VideoOff, Wifi, WifiOff, AlertTriangle,
  Crown, Users, Volume2, VolumeX, ShieldOff,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PeerData } from "@/src/hooks/useWebRTC";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function nameHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/* ─── Connection quality ───────────────────────────────────────────────────── */
function ConnectionDot({ state }: { state: RTCIceConnectionState }) {
  if (state === "connected" || state === "completed")
    return <Wifi className="h-3 w-3 text-emerald-400" />;
  if (state === "disconnected" || state === "failed")
    return <WifiOff className="h-3 w-3 text-red-400" />;
  return <AlertTriangle className="h-3 w-3 text-amber-400 animate-pulse" />;
}

/* ─── Speaking waveform ────────────────────────────────────────────────────── */
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

/* ─── Participant avatar ───────────────────────────────────────────────────── */
function ParticipantAvatar({
  name, isLocal, isSpeaking, isHost,
}: { name: string; isLocal: boolean; isSpeaking: boolean; isHost: boolean }) {
  const hue = isLocal ? 265 : nameHue(name);
  return (
    <div className="relative shrink-0">
      {/* Speaking ring */}
      {isSpeaking && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{ boxShadow: `0 0 0 2px oklch(0.65 0.18 ${hue})` }}
          animate={{ boxShadow: [`0 0 0 2px oklch(0.65 0.18 ${hue}) `, `0 0 0 4px oklch(0.55 0.18 ${hue} / 0.3)`, `0 0 0 2px oklch(0.65 0.18 ${hue})`] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
      <div
        className="h-9 w-9 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
        style={{ background: `oklch(0.45 0.18 ${hue})` }}
      >
        {name.substring(0, 2).toUpperCase()}
      </div>
      {/* Host crown */}
      {isHost && (
        <div className="absolute -top-1.5 -right-1.5 bg-amber-400 rounded-full p-0.5 shadow-sm">
          <Crown className="h-2 w-2 text-amber-900" />
        </div>
      )}
    </div>
  );
}

/* ─── Participant row ──────────────────────────────────────────────────────── */
interface ParticipantRowProps {
  userId: string;
  userName: string;
  isLocal: boolean;
  isHost: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeaking: boolean;
  connectionState: RTCIceConnectionState;
  localUserRole?: "host" | "participant";
  onMuteToggle?: () => void;
  onKick?: () => void;
}

function ParticipantRow({
  userId, userName, isLocal, isHost, isMuted, isVideoEnabled,
  isSpeaking, connectionState, localUserRole,
  onMuteToggle, onKick,
}: ParticipantRowProps) {
  const isLocalHost = localUserRole === "host";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150",
        "hover:bg-ah-glass border border-transparent hover:border-ah-glass-border",
        isSpeaking && "bg-emerald-500/5 border-emerald-500/20"
      )}
    >
      <ParticipantAvatar name={userName} isLocal={isLocal} isSpeaking={isSpeaking} isHost={isHost} />

      {/* Name section */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isSpeaking && <SpeakingWave />}
          <span className={cn(
            "text-[13px] font-medium truncate",
            isLocal ? "text-ah-text" : "text-ah-text"
          )}>
            {userName}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {isLocal && (
            <span className="text-[9px] px-1 py-px border border-violet-400/30 text-violet-400 rounded font-semibold uppercase tracking-wide">
              You
            </span>
          )}
          {isHost && (
            <span className="text-[9px] px-1 py-px border border-amber-400/30 text-amber-400 rounded font-semibold uppercase tracking-wide">
              Host
            </span>
          )}
        </div>
      </div>

      {/* Status icons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ConnectionDot state={connectionState} />
        {isMuted
          ? <MicOff className="h-3.5 w-3.5 text-red-400" />
          : <Mic className="h-3.5 w-3.5 text-emerald-400" />
        }
        {isVideoEnabled
          ? <Video className="h-3.5 w-3.5 text-violet-400" />
          : <VideoOff className="h-3.5 w-3.5 text-ah-text-subtle" />
        }
      </div>

      {/* Host quick actions */}
      {isLocalHost && !isLocal && (
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onMuteToggle}
                aria-label={isMuted ? "Allow unmute" : "Mute participant"}
                className="p-1.5 rounded-lg text-ah-text-muted hover:text-ah-text hover:bg-ah-glass transition-all"
              >
                {isMuted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-ah-surface/95 border-ah-glass-border text-ah-text text-[11px] backdrop-blur-xl">
              {isMuted ? "Allow unmute" : "Mute"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onKick}
                aria-label="Remove participant"
                className="p-1.5 rounded-lg text-ah-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <ShieldOff className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-ah-surface/95 border-ah-glass-border text-ah-text text-[11px] backdrop-blur-xl">
              Remove from room
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Props ────────────────────────────────────────────────────────────────── */
interface ParticipantsPanelProps {
  peers: Map<string, PeerData>;
  localUserId: string;
  localUserName: string;
  localIsMuted: boolean;
  localIsVideo: boolean;
  userRole: "host" | "participant";
  onHostAction: (action: string, targetUserId: string) => void;
}

/* ─── Panel ────────────────────────────────────────────────────────────────── */
export function ParticipantsPanel({
  peers, localUserId, localUserName,
  localIsMuted, localIsVideo, userRole, onHostAction,
}: ParticipantsPanelProps) {
  const peerArray = useMemo(() => Array.from(peers.entries()), [peers]);
  const total = peerArray.length + 1;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-ah-glass-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-400" />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-ah-text-muted">
            Participants
          </span>
          <span className="text-[10px] font-mono text-ah-text-subtle bg-ah-surface-raised px-1.5 py-0.5 rounded-full border border-ah-border">
            {total}
          </span>
        </div>

        {/* Mute All — host only */}
        {userRole === "host" && peerArray.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => peerArray.forEach(([id]) => onHostAction("mute", id))}
                className="flex items-center gap-1 h-6 px-2 text-[10px] rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-semibold"
              >
                <VolumeX className="h-3 w-3" />
                Mute All
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-ah-surface/95 border-ah-glass-border text-ah-text text-[11px] backdrop-blur-xl">
              Mute all participants
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-ah-text-subtle">
          In this call
        </p>

        {/* Local (always first) */}
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

        <div className="h-px bg-ah-border mx-3 my-1.5" />

        {/* Remote peers */}
        <AnimatePresence initial={false}>
          {peerArray.map(([id, peer]) => (
            <ParticipantRow
              key={id}
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
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {peerArray.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 opacity-40"
          >
            <Users className="h-10 w-10 text-ah-text-subtle mb-3" />
            <p className="text-xs text-ah-text-muted">Waiting for others to join…</p>
            <p className="text-[11px] text-ah-text-subtle mt-1">Share the room link to invite people</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
