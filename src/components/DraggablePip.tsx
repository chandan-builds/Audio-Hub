import { Grip, RotateCcw, MicOff } from "lucide-react";
import { motion } from "motion/react";
import { RefObject, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DraggablePipProps {
  stream: MediaStream;
  muted: boolean;
  boundsRef: RefObject<HTMLElement | null>;
  storageKey: string;
  className?: string;
}

type PipOffset = { x: number; y: number };

function readStoredOffset(storageKey: string): PipOffset {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return { x: 0, y: 0 };
    const parsed = JSON.parse(stored) as Partial<PipOffset>;
    return {
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : 0,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : 0,
    };
  } catch {
    return { x: 0, y: 0 };
  }
}

export function DraggablePip({
  stream,
  muted,
  boundsRef,
  storageKey,
  className,
}: DraggablePipProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [offset, setOffset] = useState<PipOffset>(() => readStoredOffset(storageKey));
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const resetPosition = () => {
    const next = { x: 0, y: 0 };
    setOffset(next);
    localStorage.removeItem(storageKey);
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={boundsRef}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(_, info) => {
        setIsDragging(false);
        const next = { x: offset.x + info.offset.x, y: offset.y + info.offset.y };
        setOffset(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
      }}
      animate={offset}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn(
        "absolute bottom-3 right-3 z-20 aspect-video w-28 overflow-hidden",
        "rounded-xl border border-white/20 bg-black",
        "shadow-2xl shadow-black/60",
        "cursor-grab touch-none active:cursor-grabbing",
        "transition-all duration-150",
        isDragging
          ? "ring-2 ring-ah-accent/60 shadow-ah-accent-glow/20 scale-105"
          : "hover:ring-1 hover:ring-white/30 hover:scale-[1.02]",
        className,
      )}
      aria-label="Drag camera preview"
    >
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        muted={muted}
        playsInline
        className="h-full w-full object-cover"
      />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.35)_100%)]" />

      {/* Controls — visible on hover */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-black/50 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/80 border border-white/10">
            <Grip className="h-2.5 w-2.5" />
            Drag
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); resetPosition(); }}
            className="rounded-md bg-black/50 backdrop-blur-sm p-1 border border-white/10 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
            title="Reset position"
            aria-label="Reset camera position"
          >
            <RotateCcw className="h-2.5 w-2.5" />
          </button>
        </div>

        {/* Muted indicator */}
        {muted && (
          <div className="absolute bottom-1.5 left-1.5 bg-red-500/80 backdrop-blur-sm rounded-md p-0.5">
            <MicOff className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
