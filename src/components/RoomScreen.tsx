import { AnimatePresence } from "motion/react";
import {
  Radio, Copy, Check, Users, MessageSquare
} from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PeerCard } from "./PeerCard";
import { ControlBar } from "./ControlBar";
import { ActivitySidebar } from "./ActivitySidebar";
import { ChatPanel } from "./ChatPanel";
import { DeviceSelector } from "./DeviceSelector";
import { useWebRTCMemory, useWebRTCCoordinator } from "@/src/hooks/useWebRTC";
import { cn } from "@/lib/utils";

interface RoomScreenProps {
  roomId: string;
  userName: string;
  userId: string;
  serverUrl: string;
  onLeave: () => void;
}

export function RoomScreen({
  roomId,
  userName,
  userId,
  serverUrl,
  onLeave,
}: RoomScreenProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [deviceSelectorOpen, setDeviceSelectorOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize Memory state
  const {
    peers,
    localStream,
    localScreenStream,
    isMuted,
    isSharingScreen,
    isConnected,
    chatMessages,
    activityLog,
    roomUserCount
  } = useWebRTCMemory();

  // Boot up the Coordinator (which initializes sub-agents)
  const agents = useWebRTCCoordinator({
    roomId,
    userId,
    userName,
    serverUrl
  });

  const peerArray = Array.from(peers.entries());

  // Find screen sharer for focus mode
  const screenSharer = peerArray.find(([_, p]) => p.isSharingScreen && p.screenStream);

  const handleCopyRoomId = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800/60 bg-zinc-950/60 backdrop-blur-xl flex items-center justify-between px-5 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-zinc-400" />
            <h1 className="font-bold tracking-tight text-zinc-200 text-sm">Audio Hub</h1>
          </div>
          <Separator orientation="vertical" className="h-4 bg-zinc-800/60" />
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-zinc-900/50 border-zinc-800/60 text-zinc-400 font-mono text-[11px]"
            >
              {roomId}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopyRoomId}
                  className="p-1 hover:bg-zinc-800 rounded-md transition-colors"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                Copy invite link
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={cn(
            "h-2 w-2 rounded-full",
            isConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
          )} />
        </div>

        <div className="flex items-center gap-3">
          {/* User avatars */}
          <div className="flex -space-x-2 mr-2">
            <Avatar className="h-7 w-7 border-2 border-zinc-950">
              <AvatarFallback className="bg-zinc-800 text-[10px] font-bold">
                {userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {peerArray.slice(0, 3).map(([id, peer]) => (
              <Avatar key={id} className="h-7 w-7 border-2 border-zinc-950">
                <AvatarFallback className="bg-zinc-900 text-[10px]">
                  {peer.userName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {peerArray.length > 3 && (
              <Avatar className="h-7 w-7 border-2 border-zinc-950">
                <AvatarFallback className="bg-zinc-900 text-[10px] text-zinc-500">
                  +{peerArray.length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          <Badge className="bg-zinc-800/60 text-zinc-400 border-zinc-700/40 text-[10px] font-mono gap-1">
            <Users className="h-3 w-3" />
            {roomUserCount}
          </Badge>

          {/* Chat toggle for desktop */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setChatOpen(!chatOpen)}
            className={cn(
              "rounded-full h-8 w-8 border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-800 hidden xl:flex",
              chatOpen && "bg-violet-950/30 border-violet-800/40 text-violet-400"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="destructive"
            onClick={() => {
              agents.disconnect();
              onLeave();
            }}
            size="sm"
            className="bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-900/40 hidden xl:flex h-8 text-xs"
          >
            Leave
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Screen Share Focus Mode */}
            {screenSharer && (
              <div className="mb-6">
                <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800/50 shadow-2xl shadow-black/50">
                  <video
                    autoPlay
                    muted
                    playsInline
                    ref={(el) => {
                      if (el && screenSharer[1].screenStream) {
                        el.srcObject = screenSharer[1].screenStream;
                      }
                    }}
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-xs text-zinc-500 text-center mt-2 font-mono">
                  {screenSharer[1].userName}'s screen
                </p>
              </div>
            )}

            {/* Screen share from local */}
            {isSharingScreen && localScreenStream && !screenSharer && (
              <div className="mb-6">
                <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800/50 shadow-2xl shadow-black/50">
                  <video
                    autoPlay
                    muted
                    playsInline
                    ref={(el) => {
                      if (el && localScreenStream) {
                        el.srcObject = localScreenStream;
                      }
                    }}
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-xs text-zinc-500 text-center mt-2 font-mono">
                  Your screen
                </p>
              </div>
            )}

            {/* Participant Grid */}
            <div className={cn(
              "grid gap-4",
              screenSharer
                ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}>
              {/* Local user */}
              <PeerCard
                peer={{
                  userId: "local",
                  userName,
                  stream: localStream,
                  screenStream: localScreenStream,
                  connection: null as any,
                  isMuted,
                  isSharingScreen,
                  connectionState: "connected",
                  audioLevel: 0,
                }}
                isLocal
                localUserName={userName}
                isMuted={isMuted}
                isSharingScreen={isSharingScreen}
                localStream={localStream}
              />

              {/* Remote peers */}
              <AnimatePresence>
                {peerArray.map(([id, peer]) => (
                  <PeerCard key={id} peer={peer} />
                ))}
              </AnimatePresence>

              {/* Empty state */}
              {peerArray.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 opacity-20">
                  <Users className="h-14 w-14 mb-4" />
                  <p className="text-lg font-medium">Waiting for others...</p>
                  <p className="text-sm font-mono mt-1">Room: {roomId}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity Sidebar */}
        <ActivitySidebar
          activityLog={activityLog}
          roomUserCount={roomUserCount}
        />
      </main>

      {/* Control Bar */}
      <ControlBar
        isMuted={isMuted}
        isSharingScreen={isSharingScreen}
        onToggleMute={agents.toggleMute}
        onToggleScreenShare={agents.toggleScreenShare}
        onLeave={() => {
          agents.disconnect();
          onLeave();
        }}
        onOpenDeviceSelector={() => setDeviceSelectorOpen(true)}
      />

      {/* Chat Panel */}
      <ChatPanel
        messages={chatMessages}
        onSendMessage={agents.sendChatMessage}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
      />

      {/* Device Selector Modal */}
      <DeviceSelector
        isOpen={deviceSelectorOpen}
        onClose={() => setDeviceSelectorOpen(false)}
        onSelectDevice={agents.switchAudioDevice}
      />
    </div>
  );
}
