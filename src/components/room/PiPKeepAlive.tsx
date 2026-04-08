import { useEffect, useRef, useState } from "react";
import { CopyMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function PiPKeepAlive() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);

  useEffect(() => {
    // Check if Picture-in-Picture is supported
    if ("pictureInPictureEnabled" in document) {
      setIsSupported(true);
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let animationFrameId: number;
    let time = 0;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw loop for the PIP video
    const draw = () => {
      time += 0.05;
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);

      // Draw pulsating circles
      const pulse = Math.sin(time) * 0.5 + 0.5;
      
      ctx.beginPath();
      ctx.arc(0, 0, 40 + pulse * 20, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139, 92, 246, ${1 - pulse})`; // violet
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fillStyle = "#8b5cf6";
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Audio Hub", 0, 80);
      
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText("Background Active", 0, 105);

      ctx.restore();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    // Start video stream from canvas
    const stream = canvas.captureStream(24);
    video.srcObject = stream;
    video.play().catch(console.error);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => setIsPipActive(true);
    const onLeave = () => setIsPipActive(false);

    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, []);

  const handlePiP = async () => {
    try {
      const video = videoRef.current;
      if (!video) return;

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (error) {
      console.error("PiP failed:", error);
    }
  };

  if (!isSupported) return null;

  return (
    <>
      <canvas ref={canvasRef} width={300} height={300} className="hidden" />
      <video 
        ref={videoRef} 
        muted 
        playsInline 
        autoPlay 
        className="hidden" 
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handlePiP}
            className="h-12 w-12 rounded-full border-zinc-700/50 bg-[#27272a]/60 hover:bg-zinc-700 transition-all duration-200"
          >
            <CopyMinus className={`h-5 w-5 ${isPipActive ? "text-violet-400" : "text-zinc-400"}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300 mb-2">
          {isPipActive ? "Stop Background Mode" : "Background Mode (PiP)"}
        </TooltipContent>
      </Tooltip>
    </>
  );
}
