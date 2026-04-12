import { useEffect, useRef, useState, memo } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface MicTestBarProps {
  stream: MediaStream | null;
  isMuted?: boolean;
  barCount?: number;
  className?: string;
}

const BAR_COUNT = 14;

/**
 * Real-time microphone level visualizer using Web Audio API AnalyserNode.
 * Renders animated bar graph that responds to voice input.
 */
export const MicTestBar = memo(function MicTestBar({
  stream,
  isMuted = false,
  barCount = BAR_COUNT,
  className,
}: MicTestBarProps) {
  const [levels, setLevels] = useState<number[]>(Array(barCount).fill(0));
  const [isActive, setIsActive] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef   = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream || isMuted) {
      setLevels(Array(barCount).fill(0));
      setIsActive(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    // Create AudioContext (must be created in response to user gesture, but
    // the pre-join screen has been opened by user interaction so this is fine).
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.6;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      // Map frequency bins to bar levels (0–1)
      const bins = dataArray.length;
      const newLevels = Array.from({ length: barCount }, (_, i) => {
        const start = Math.floor((i / barCount) * bins);
        const end   = Math.floor(((i + 1) / barCount) * bins);
        const slice = dataArray.slice(start, end);
        const avg   = slice.reduce((a, b) => a + b, 0) / (slice.length || 1);
        return avg / 255;
      });
      const hasSignal = newLevels.some(l => l > 0.02);
      setIsActive(hasSignal);
      setLevels(newLevels);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      source.disconnect();
      ctx.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      setLevels(Array(barCount).fill(0));
      setIsActive(false);
    };
  }, [stream, isMuted, barCount]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isMuted ? (
            <MicOff className="h-3.5 w-3.5 text-ah-text-muted" />
          ) : (
            <Mic className={cn("h-3.5 w-3.5 transition-colors duration-200",
              isActive ? "text-ah-success" : "text-ah-text-muted"
            )} />
          )}
          <span className="text-xs font-medium text-ah-text-muted">
            {isMuted ? "Muted" : isActive ? "Microphone working" : "Speak to test…"}
          </span>
        </div>
        {isActive && !isMuted && (
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ah-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-ah-success"></span>
          </div>
        )}
      </div>

      {/* Bar visualizer */}
      <div
        className="flex items-end gap-[2px] h-8 w-full"
        aria-label={`Microphone level: ${isMuted ? "muted" : isActive ? "active" : "silent"}`}
        role="meter"
        aria-valuenow={Math.round(levels.reduce((a, b) => a + b, 0) / levels.length * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {levels.map((level, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full transition-all duration-75 ease-out min-h-[3px]",
              isMuted
                ? "bg-ah-border"
                : level > 0.6
                  ? "bg-gradient-to-t from-ah-success to-emerald-300 shadow-[0_0_8px_var(--ah-success)]"
                  : level > 0.3
                    ? "bg-gradient-to-t from-ah-success/80 to-emerald-400/80"
                    : "bg-ah-border/50 bg-gradient-to-t from-ah-border to-ah-border/50"
            )}
            style={{
              height: `${Math.max(3, level * 36)}px`,
              opacity: isMuted ? 0.3 : Math.max(0.3, level + 0.3),
            }}
          />
        ))}
      </div>
    </div>
  );
});
