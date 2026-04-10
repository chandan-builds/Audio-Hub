import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MicOff, VideoOff, ChevronDown, ChevronUp, GripHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FloatingSelfViewProps {
  localVideoStream: MediaStream | null;
  userName: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  /** Show only when another peer is in focus / presentation active */
  visible: boolean;
}

const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;
type Corner = typeof CORNERS[number];

const CORNER_CLASSES: Record<Corner, string> = {
  "bottom-right": "bottom-24 right-4",
  "bottom-left":  "bottom-24 left-4",
  "top-right":    "top-20 right-4",
  "top-left":     "top-20 left-4",
};

export function FloatingSelfView({
  localVideoStream,
  userName,
  isMuted,
  isVideoEnabled,
  visible,
}: FloatingSelfViewProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const [corner, setCorner]       = useState<Corner>("bottom-right");
  const [collapsed, setCollapsed] = useState(false);
  const dragRef     = useRef<{ startX: number; startY: number } | null>(null);
  const [dragging, setDragging]   = useState(false);

  /* Attach stream */
  useEffect(() => {
    if (videoRef.current && localVideoStream) {
      if (videoRef.current.srcObject !== localVideoStream) {
        videoRef.current.srcObject = localVideoStream;
      }
    } else if (videoRef.current && !localVideoStream) {
      videoRef.current.srcObject = null;
    }
  }, [localVideoStream]);

  /* Corner snapping on drag end */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current = null;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // Treat as click

    const midX = window.innerWidth  / 2;
    const midY = window.innerHeight / 2;
    const isRight  = e.clientX > midX;
    const isBottom = e.clientY > midY;

    if (isBottom && isRight)  setCorner("bottom-right");
    if (isBottom && !isRight) setCorner("bottom-left");
    if (!isBottom && isRight) setCorner("top-right");
    if (!isBottom && !isRight) setCorner("top-left");
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="floating-self"
          className={cn(
            "fixed z-[100] cursor-grab active:cursor-grabbing select-none",
            CORNER_CLASSES[corner]
          )}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          style={{ touchAction: "none" }}
        >
          <motion.div
            className={cn(
              "relative rounded-2xl overflow-hidden border-2 shadow-2xl shadow-black/40",
              "border-violet-500/50 dark:border-violet-400/40",
              collapsed ? "w-16 h-10" : "w-36 h-24 sm:w-44 sm:h-28",
              dragging && "ring-2 ring-violet-400/60"
            )}
            layout
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            {/* Video / Avatar */}
            {isVideoEnabled && localVideoStream ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900 dark:bg-zinc-950">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-violet-900/50 text-violet-200 text-sm font-bold">
                    {userName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}

            {/* Overlay */}
            {!collapsed && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none">
                <div className="absolute bottom-1.5 left-2 flex items-center gap-1">
                  <span className="text-[9px] text-white/90 font-medium leading-none">You</span>
                  {isMuted && <MicOff className="h-2.5 w-2.5 text-red-400" />}
                  {!isVideoEnabled && <VideoOff className="h-2.5 w-2.5 text-zinc-400" />}
                </div>
              </div>
            )}

            {/* Drag handle hint */}
            {!collapsed && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                <GripHorizontal className="h-3 w-3 text-white/60" />
              </div>
            )}
          </motion.div>

          {/* Collapse toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(c => !c)}
                className="absolute -top-2 -right-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full p-0.5 border border-zinc-700 shadow-md transition-colors z-10"
                aria-label={collapsed ? "Expand self view" : "Collapse self view"}
              >
                {collapsed
                  ? <ChevronUp className="h-3 w-3" />
                  : <ChevronDown className="h-3 w-3" />
                }
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 border-zinc-700 text-zinc-200 text-[11px]">
              {collapsed ? "Show self" : "Minimize"}
            </TooltipContent>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
