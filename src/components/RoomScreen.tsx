import { AnimatePresence, motion } from "motion/react";
import {
  Radio, Copy, Check, Users, MessageSquare, Maximize2, Minimize2, ZoomIn, ZoomOut, MousePointer2 
} from "lucide-react";
import React, { useState, useRef, useEffect, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./ThemeToggle";
import { PeerCard } from "./PeerCard";
import { ControlBar } from "./ControlBar";
import { ActivitySidebar } from "./ActivitySidebar";
import { ChatPanel } from "./ChatPanel";
import { DeviceSelector } from "./DeviceSelector";
import { useWebRTCMemory, useWebRTCCoordinator } from "@/src/hooks/useWebRTC";
import { cn } from "@/lib/utils";

const ScreenShareFocus = memo(function ScreenShareFocus({ stream, userName }: { stream: MediaStream, userName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [stream]);

  // Handle Fullscreen changes natively
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed", err);
    }
  };

  const showControls = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isDragging.current && !document.querySelector('.zoom-controls:hover')) {
        setControlsVisible(false);
      }
    }, 2500);
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Event handlers for drag & zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!isFullscreen) return; // Only zoom inside fullscreen
    e.preventDefault();
    setScale((prev) => {
      const newScale = prev - e.deltaY * 0.005;
      return Math.min(Math.max(1, newScale), 5); // Clamped between 1x and 5x
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= 1 || !isFullscreen) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    if (containerRef.current) containerRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    showControls();
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    if (containerRef.current) containerRef.current.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={showControls}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={toggleFullscreen}
      className={cn(
        "bg-zinc-100 dark:bg-black overflow-hidden relative group select-none touch-none",
        isFullscreen ? "w-screen h-screen m-0 rounded-none border-0" : "mb-6 w-full aspect-video md:h-[60vh] rounded-2xl border border-zinc-200 dark:border-zinc-800/50 shadow-2xl shadow-black/5 dark:shadow-black/50"
      )}
    >
      <div 
        className="w-full h-full flex items-center justify-center transform-gpu"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging.current ? "none" : "transform 0.15s ease-out",
          cursor: scale > 1 ? (isDragging.current ? "grabbing" : "grab") : "default"
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain pointer-events-none"
        />
      </div>
      
      {/* HUD overlays */}
      <AnimatePresence>
        {(controlsVisible || !isFullscreen) && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute top-4 left-4">
              <Badge className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-200 shadow-lg pointer-events-auto">
                {userName}'s screen
              </Badge>
            </div>
            
            <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto zoom-controls">
              {isFullscreen && (
                <>
                  <div className="flex items-center gap-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/50 p-1.5 rounded-lg shadow-lg">
                    <button onClick={resetZoom} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-600 dark:text-zinc-300" title="Reset Zoom">
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="text-[10px] font-mono font-bold w-10 text-center text-zinc-800 dark:text-zinc-200">
                      {Math.round(scale * 100)}%
                    </span>
                    <button onClick={() => setScale(s => Math.min(5, s + 0.5))} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-600 dark:text-zinc-300" title="Zoom In">
                      <ZoomIn className="h-4 w-4" />
                    </button>
                  </div>
                  {scale > 1 && (
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/50 h-8 px-3 rounded-lg shadow-lg flex items-center gap-2">
                       <MousePointer2 className="h-3.5 w-3.5 text-violet-500" />
                       <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">Drag to pan</span>
                    </div>
                  )}
                </>
              )}
              
              <button 
                onClick={toggleFullscreen}
                className="bg-white/80 hover:bg-white dark:bg-zinc-900/80 dark:hover:bg-zinc-900 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/50 p-2 rounded-lg shadow-lg text-zinc-700 dark:text-zinc-200 transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen (Double-click)"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});


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
  const [globalVolume, setGlobalVolume] = useState(1);

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
    <div className="flex flex-col h-[100dvh] bg-zinc-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="h-14 border-b border-zinc-200 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/60 backdrop-blur-xl flex items-center justify-between px-5 z-10 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <h1 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-200 text-sm">Audio Hub</h1>
          </div>
          <Separator orientation="vertical" className="h-4 bg-zinc-200 dark:bg-zinc-800/60" />
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800/60 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]"
            >
              {roomId}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopyRoomId}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
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
            <Avatar className="h-7 w-7 border-2 border-white dark:border-zinc-950">
              <AvatarFallback className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold">
                {userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {peerArray.slice(0, 3).map(([id, peer]) => (
              <Avatar key={id} className="h-7 w-7 border-2 border-white dark:border-zinc-950">
                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-[10px]">
                  {peer.userName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {peerArray.length > 3 && (
              <Avatar className="h-7 w-7 border-2 border-white dark:border-zinc-950">
                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-900 text-[10px] text-zinc-500">
                  +{peerArray.length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          <Badge className="bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/40 text-[10px] font-mono gap-1">
            <Users className="h-3 w-3" />
            {roomUserCount}
          </Badge>

          <ThemeToggle isCompact />

          {/* Chat toggle for desktop */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setChatOpen(!chatOpen)}
            className={cn(
              "rounded-full h-8 w-8 border-zinc-200 dark:border-zinc-800/60 bg-zinc-100 dark:bg-zinc-900/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 hidden xl:flex text-zinc-600 dark:text-zinc-400",
              chatOpen && "bg-violet-100 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/40 text-violet-600 dark:text-violet-400 hover:bg-violet-200 hover:text-violet-700 dark:hover:bg-violet-900/50"
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
            className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/40 hidden xl:flex h-8 text-xs font-semibold"
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
              <ScreenShareFocus 
                stream={screenSharer[1].screenStream} 
                userName={screenSharer[1].userName} 
              />
            )}

            {/* Screen share from local */}
            {isSharingScreen && localScreenStream && !screenSharer && (
              <ScreenShareFocus 
                stream={localScreenStream} 
                userName="Your" 
              />
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
                volume={globalVolume}
              />

              {/* Remote peers */}
              <AnimatePresence>
                {peerArray.map(([id, peer]) => (
                  <PeerCard key={id} peer={peer} volume={globalVolume} />
                ))}
              </AnimatePresence>

              {/* Empty state */}
              {peerArray.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 opacity-30 dark:opacity-20">
                  <Users className="h-14 w-14 mb-4 text-zinc-500" />
                  <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Waiting for others...</p>
                  <p className="text-sm font-mono mt-1 text-zinc-600 dark:text-zinc-400">Room: {roomId}</p>
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
        volume={globalVolume}
        onVolumeChange={setGlobalVolume}
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
