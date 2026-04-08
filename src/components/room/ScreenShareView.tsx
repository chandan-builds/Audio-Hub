// src/components/room/ScreenShareView.tsx
import { useRef, useEffect } from "react";
import { Maximize2, MicOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ScreenShareViewProps {
  stream: MediaStream;
  userName: string;
  isMuted: boolean;
}

export function ScreenShareView({ stream, userName, isMuted }: ScreenShareViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="w-full flex-1 min-h-0 bg-black/40 rounded-3xl overflow-hidden relative border border-zinc-800/80 shadow-2xl shadow-black/50 group ring-1 ring-white/5">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      
      {/* Overlay controls & info */}
      <div className="absolute top-6 left-6 flex gap-2">
        <Badge className="bg-[#18181b]/80 backdrop-blur-xl border border-zinc-700/50 text-zinc-100 shadow-lg px-3 py-1 font-medium text-xs">
          {userName}'s screen
        </Badge>
        {isMuted && (
          <Badge className="bg-red-950/60 backdrop-blur-md border border-red-900/50 text-red-400 shadow-md">
            <MicOff className="h-3 w-3 mr-1.5" />
            Muted
          </Badge>
        )}
      </div>

      <button className="absolute top-6 right-6 h-10 w-10 rounded-full bg-[#18181b]/50 backdrop-blur-xl border border-zinc-700/50 text-zinc-300 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center transition-all hover:bg-[#27272a]/80 hover:scale-105 active:scale-95 shadow-lg">
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}
