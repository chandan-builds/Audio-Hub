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
        "relative w-full aspect-video rounded-3xl overflow-hidden",
        "bg-zinc-900 border border-zinc-800/60",
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
                <Loader2 className="h-8 w-8 text-zinc-500 animate-spin" />
                <p className="text-xs text-zinc-500">Starting camera…</p>
              </>
            ) : (
              <>
                {/* Avatar fallback */}
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
                  <span className="text-2xl font-bold text-white">{getInitials(fallbackName)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <VideoOff className="h-3.5 w-3.5" />
                  <span className="text-xs">Camera off</span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle vignette overlay for depth */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none ring-1 ring-inset ring-white/5" />
    </div>
  );
});
