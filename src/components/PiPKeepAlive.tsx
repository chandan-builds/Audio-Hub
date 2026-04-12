import { useEffect, useRef, useState } from "react";
import { PictureInPicture } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PiPKeepAliveProps {
  isMuted: boolean;
  onToggleMute: () => void;
}

export function PiPKeepAlive({ isMuted, onToggleMute }: PiPKeepAliveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMutedRef = useRef(isMuted);
  const [isSupported, setIsSupported] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);

  // Keep ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
    
    // Update MediaSession state if active
    if ("mediaSession" in navigator && isPipActive) {
      try {
        // @ts-ignore - togglemicrophone is relatively new
        navigator.mediaSession.setMicrophoneActive?.(!isMuted);
      } catch (e) {
        console.warn("MediaSession setMicrophoneActive failed", e);
      }
    }
  }, [isMuted, isPipActive]);

  // Initialize stream when supported and refs are ready
  useEffect(() => {
    if (!isSupported) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    console.log("Initializing PiP stream...");

    let animationFrameId: number;
    let time = 0;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      time += 0.05;
      const muted = isMutedRef.current;
      
      // Clear background
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);

      const pulse = Math.sin(time) * 0.5 + 0.5;
      
      // Main pulsating ring - scaled for 800x800
      ctx.beginPath();
      ctx.arc(0, 0, 100 + pulse * 40, 0, Math.PI * 2);
      ctx.fillStyle = muted 
        ? `rgba(239, 68, 68, ${0.4 - pulse * 0.2})`
        : `rgba(139, 92, 246, ${1 - pulse})`;
      ctx.fill();

      // Inner circle
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fillStyle = muted ? "#ef4444" : "#8b5cf6";
      ctx.fill();

      // Mute indicator icon
      if (muted) {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-25, -25);
        ctx.lineTo(25, 25);
        ctx.moveTo(25, -25);
        ctx.lineTo(-25, 25);
        ctx.stroke();
      }

      ctx.fillStyle = "white";
      ctx.font = "bold 48px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Audio Hub", 0, 180);
      
      ctx.font = "24px sans-serif";
      ctx.fillStyle = muted ? "#f87171" : "#a1a1aa";
      ctx.fillText(muted ? "Microphone Muted" : "Background Active", 0, 240);

      ctx.restore();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    try {
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      video.play().catch(err => console.error("Initial video play failed:", err));
      console.log("PiP stream attached to video");
    } catch (err) {
      console.error("Canvas stream capture failed:", err);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isSupported]);

  useEffect(() => {
    // Basic heuristics to determine if PiP for video is supported
    if (document.pictureInPictureEnabled || "requestPictureInPicture" in HTMLVideoElement.prototype) {
      setIsSupported(true);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => {
      setIsPipActive(true);
      
      // Set up MediaSession actions when entering PiP
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Audio Hub",
          artist: "Background Mode",
          album: "Live Session",
          artwork: [
            { src: "https://via.placeholder.com/512x512/8b5cf6/ffffff?text=AH", sizes: "512x512", type: "image/png" }
          ]
        });

        try {
          // @ts-ignore
          navigator.mediaSession.setActionHandler("togglemicrophone", () => {
            onToggleMute();
          });
        } catch (e) {
          // Fallback to other actions if togglemicrophone is not supported
          navigator.mediaSession.setActionHandler("play", () => onToggleMute());
          navigator.mediaSession.setActionHandler("pause", () => onToggleMute());
        }
      }
    };

    const onLeave = () => {
      setIsPipActive(false);
    };

    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [onToggleMute]);

  const handlePiP = async () => {
    console.log("handlePiP clicked");
    try {
      const video = videoRef.current;
      if (!video) {
        console.error("Video ref is null");
        return;
      }

      console.log("Video state:", {
        readyState: video.readyState,
        paused: video.paused,
        srcObject: !!video.srcObject
      });

      // Crucial: some browsers require the video to be playing AND have been interacted with
      await video.play().catch(err => console.warn("Video play failed:", err));

      if (document.pictureInPictureElement) {
        console.log("Exiting PiP");
        await document.exitPictureInPicture();
      } else {
        console.log("Requesting PiP");
        if (video.readyState < 2) {
           console.log("Waiting for metadata...");
           await new Promise((resolve) => {
             video.onloadedmetadata = resolve;
             setTimeout(resolve, 1000); // Timeout fallback
           });
        }
        await video.requestPictureInPicture();
        console.log("PiP success");
      }
    } catch (error) {
      console.error("PiP failed error:", error);
      alert("Background Mode (PiP) failed. Please ensure you've interacted with the page and try again.");
    }
  };

  if (!isSupported) return null;

  return (
    <>
      {/* 
        Some browsers require the video and canvas to be "attached" to the DOM 
        and somewhat visible to keep the stream alive or allow PiP.
        We use small size and high z-index but low opacity instead of -top-1000
      */}
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={800} 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '10px',
          height: '10px',
          opacity: 0.01,
          pointerEvents: 'none',
          zIndex: -1
        }}
      />
      <video 
        ref={videoRef} 
        muted 
        playsInline 
        autoPlay 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '10px',
          height: '10px',
          opacity: 0.01,
          pointerEvents: 'none',
          zIndex: -1
        }}
      />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              onClick={handlePiP}
              className="h-12 w-12 flex-shrink-0 rounded-full border-zinc-200 dark:border-zinc-800/60 bg-zinc-100 dark:bg-zinc-900/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-200"
            />
          }
        >
          <PictureInPicture className={`h-5 w-5 ${isPipActive ? "text-violet-500 dark:text-violet-400" : "text-zinc-600 dark:text-zinc-400"}`} />
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
          {isPipActive ? "Stop Background Mode" : "Background Mode (PiP)"}
        </TooltipContent>
      </Tooltip>
    </>
  );
}
