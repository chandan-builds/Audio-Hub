// src/components/room/RoomHeader.tsx
import { Radio, Copy, Check, Users, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PeerData } from "@/src/hooks/useWebRTC";
import { useState } from "react";

interface RoomHeaderProps {
  roomId: string;
  userName: string;
  isConnected: boolean;
  roomUserCount: number;
  peerArray: [string, PeerData][];
  chatOpen?: boolean;
  onToggleChat?: () => void;
  onLeave: () => void;
}

export function RoomHeader({
  roomId,
  userName,
  isConnected,
  roomUserCount,
  peerArray,
  chatOpen,
  onToggleChat,
  onLeave,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyRoomId = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 border-b border-zinc-800/40 bg-[#09090b]/40 backdrop-blur-3xl flex items-center justify-between px-6 z-10 sticky top-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg outline outline-1 outline-violet-500/30 bg-violet-500/10 flex items-center justify-center">
            <Radio className="h-4 w-4 text-violet-400" />
          </div>
          <h1 className="font-bold tracking-tight text-zinc-100 text-sm hidden sm:block">Audio Hub</h1>
        </div>
        
        <Separator orientation="vertical" className="h-6 bg-zinc-800/60 hidden sm:block" />
        
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-[#18181b]/80 border-zinc-700/60 text-zinc-300 font-mono text-[11px] px-2 py-0.5"
          >
            {roomId}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleCopyRoomId}
                className="p-1.5 bg-[#18181b]/50 hover:bg-zinc-800 rounded-md transition-all border border-zinc-800/50"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-zinc-400" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
              Copy invitation link
            </TooltipContent>
          </Tooltip>
        </div>
        
        <div className="flex items-center gap-2 ml-2">
          <div className={cn(
            "h-2.5 w-2.5 rounded-full ring-2 ring-[#09090b]",
            isConnected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]"
          )} />
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 hidden sm:block">
            {isConnected ? 'Live' : 'Connecting'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* User avatars group */}
        <div className="flex items-center">
          <div className="flex -space-x-3 mr-3 items-center">
            <Avatar className="h-8 w-8 border-2 border-[#09090b] shadow-sm relative z-40">
              <AvatarFallback className="bg-gradient-to-br from-violet-600 to-fuchsia-600 text-[10px] font-bold text-white">
                {userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {peerArray.slice(0, 3).map(([id, peer], idx) => (
              <Avatar key={id} className={`h-8 w-8 border-2 border-[#09090b] shadow-sm relative z-[${30 - idx}]`}>
                <AvatarFallback className="bg-zinc-800 text-[10px] text-zinc-300">
                  {peer.userName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {peerArray.length > 3 && (
              <Avatar className="h-8 w-8 border-2 border-[#09090b] shadow-sm relative z-0">
                <AvatarFallback className="bg-zinc-900 text-[10px] text-zinc-500 font-bold border border-zinc-800">
                  +{peerArray.length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          <Badge className="bg-zinc-800/40 text-zinc-300 border-zinc-700/40 text-[10px] font-mono gap-1.5 px-2 py-0.5 shadow-sm hidden md:flex">
            <Users className="h-3 w-3 text-zinc-400" />
            {roomUserCount}
          </Badge>
        </div>

        {/* Chat toggle for desktop (only if provided) */}
        {onToggleChat && (
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleChat}
            className={cn(
              "rounded-xl h-10 w-10 border-zinc-800/60 bg-[#18181b]/80 hover:bg-zinc-800 hidden xl:flex shadow-sm transition-all",
              chatOpen && "bg-violet-500/20 border-violet-500/40 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
            )}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}

        <Separator orientation="vertical" className="h-6 bg-zinc-800/60 hidden md:block" />

        {/* Mobile controls */}
        <Button
          variant="destructive"
          onClick={onLeave}
          className="bg-red-600 hover:bg-red-500 text-white font-medium md:hidden h-10 px-4 rounded-xl shadow-lg shadow-red-900/20"
        >
          Leave
        </Button>
      </div>
    </header>
  );
}
