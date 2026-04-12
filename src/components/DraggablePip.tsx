import { Grip, RotateCcw } from "lucide-react";
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

type PipOffset = {
  x: number;
  y: number;
};

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

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
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
      onDragEnd={(_, info) => {
        const next = {
          x: offset.x + info.offset.x,
          y: offset.y + info.offset.y,
        };
        setOffset(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
      }}
      animate={offset}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn(
        "absolute bottom-3 right-3 z-20 aspect-video w-32 overflow-hidden rounded-md border border-white/25 bg-black shadow-2xl shadow-black/40",
        "cursor-grab touch-none active:cursor-grabbing",
        className,
      )}
      aria-label="Drag camera preview"
    >
      <video
        ref={videoRef}
        autoPlay
        muted={muted}
        playsInline
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/65 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="inline-flex items-center gap-1 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/85">
          <Grip className="h-3 w-3" />
          Drag
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            resetPosition();
          }}
          className="rounded bg-black/45 p-1 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
          title="Reset camera position"
          aria-label="Reset camera position"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}
