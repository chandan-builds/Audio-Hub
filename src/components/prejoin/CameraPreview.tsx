import { useEffect, useRef, useState, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VideoOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraPreviewProps {
  stream: MediaStream | null;
  isLoading?: boolean;
  fallbackName?: string;
  className?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const CameraPreview = memo(function CameraPreview({
  stream,
  isLoading = false,
  fallbackName = "You",
  className,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (stream) {
      const videoTracks = stream.getVideoTracks();
      setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      el.srcObject = stream;
      el.play().catch(() => {/* autoplay policy – user hasn't interacted yet */});
    } else {
      el.srcObject = null;
      setHasVideo(false);
    }

    const handleTrackChange = () => {
      if (stream) {
        const tracks = stream.getVideoTracks();
        setHasVideo(tracks.length > 0 && tracks[0].enabled && tracks[0].readyState === "live");
      }
    };

    stream?.getTracks().forEach(t => {
      t.addEventListener("ended", handleTrackChange);
      t.addEventListener("mute", handleTrackChange);
    });

    return () => {
      stream?.getTracks().forEach(t => {
        t.removeEventListener("ended", handleTrackChange);
        t.removeEventListener("mute", handleTrackChange);
      });
    };
  }, [stream]);

  return (
    <div
      className={cn(
        "relative w-full aspect-video rounded-[var(--ah-card-radius)] overflow-hidden",
        "bg-ah-surface/30 backdrop-blur-xl border border-ah-glass-border shadow-inner font-sans",
        className
      )}
      aria-label="Camera preview"
    >
      {/* Mirror video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn(
          "absolute inset-0 w-full h-full object-cover",
          "scale-x-[-1]", // mirror effect
          "transition-opacity duration-500",
          hasVideo && !isLoading ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Fallback overlay — shown when no video or loading */}
      <AnimatePresence>
        {(!hasVideo || isLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-8 w-8 text-ah-text-muted animate-spin" />
                <p className="text-xs text-ah-text-muted">Starting camera…</p>
              </>
            ) : (
              <>
                {/* Avatar fallback */}
                <div className="h-20 w-20 rounded-full bg-ah-accent flex items-center justify-center">
                  <span className="text-xl font-medium text-white tracking-wide">{getInitials(fallbackName)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-ah-text-muted">
                  <VideoOff className="h-3.5 w-3.5" />
                  <span className="text-xs">Camera off</span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle vignette overlay for depth */}
      <div className="absolute inset-0 rounded-[var(--ah-card-radius)] pointer-events-none ring-1 ring-inset ring-white/10 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.3)_100%)]" />

      {/* Camera Preview Status Badge */}
      <div className="absolute top-3 left-3 bg-black/45 backdrop-blur-md text-[10px] font-medium text-white/85 px-2 py-0.5 rounded-md border border-white/10 pointer-events-none">
        {hasVideo && !isLoading ? "Live preview" : "Preview"}
      </div>
    </div>
  );
});
