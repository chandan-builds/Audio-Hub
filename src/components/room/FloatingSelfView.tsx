import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MicOff, VideoOff, ChevronDown, ChevronUp, GripHorizontal, User } from "lucide-react";
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

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

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
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);

  /* Attach stream */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (localVideoStream) {
      if (el.srcObject !== localVideoStream) el.srcObject = localVideoStream;
    } else {
      el.srcObject = null;
    }
  }, [localVideoStream]);

  /* Corner snapping on drag end */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
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
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          style={{ touchAction: "none" }}
        >
          {/* Inner card */}
          <motion.div
            className={cn(
              "relative overflow-hidden shadow-2xl shadow-black/50",
              "rounded-2xl border-2",
              // Styling states
              isMuted
                ? "border-red-400/50"
                : "border-ah-accent/50",
              collapsed ? "w-14 h-10" : "w-36 h-24 sm:w-44 sm:h-28",
              isDragging && "ring-2 ring-ah-accent/40 scale-105",
            )}
            layout
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            {/* Backdrop blur surface */}
            <div className="absolute inset-0 bg-ah-surface/40 backdrop-blur-md" />

            {/* Video or avatar */}
            {isVideoEnabled && localVideoStream ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-ah-surface/80 backdrop-blur-md">
                {isVideoEnabled ? (
                  <User className="h-7 w-7 text-ah-text-muted" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-ah-accent to-blue-600 flex items-center justify-center shadow-lg">
                      <span className="text-xs font-bold text-white">{getInitials(userName)}</span>
                    </div>
                    {!collapsed && (
                      <VideoOff className="h-3 w-3 text-ah-text-muted" />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Vignette overlay */}
            {!collapsed && (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.3)_100%)] pointer-events-none" />
            )}

            {/* Info bar */}
            {!collapsed && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-2 py-1.5 pointer-events-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/90 font-semibold leading-none truncate">You</span>
                  {isMuted && (
                    <div className="bg-red-500/80 rounded p-0.5">
                      <MicOff className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  {!isVideoEnabled && (
                    <div className="bg-black/50 rounded p-0.5">
                      <VideoOff className="h-2.5 w-2.5 text-white/70" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Drag hint */}
            {!collapsed && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-black/40 backdrop-blur-sm rounded px-1 py-0.5">
                  <GripHorizontal className="h-2.5 w-2.5 text-white/60" />
                </div>
              </div>
            )}

            {/* Muted indicator when collapsed */}
            {collapsed && isMuted && (
              <div className="absolute inset-0 flex items-center justify-center">
                <MicOff className="h-4 w-4 text-red-400" />
              </div>
            )}
          </motion.div>

          {/* Collapse/expand toggle button */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              "absolute -top-2 -right-2 z-10",
              "bg-ah-surface/80 backdrop-blur-md border border-ah-glass-border",
              "hover:bg-ah-surface-raised hover:border-ah-border",
              "text-ah-text-muted hover:text-ah-text",
              "rounded-full p-1 shadow-lg transition-all duration-150",
            )}
            aria-label={collapsed ? "Expand self view" : "Collapse self view"}
          >
            {collapsed
              ? <ChevronUp className="h-3 w-3" />
              : <ChevronDown className="h-3 w-3" />
            }
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
