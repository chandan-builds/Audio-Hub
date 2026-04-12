/**
 * RecordingControls — Start/stop recording + download + elapsed timer display.
 *
 * Phase 5.3 of the "Beyond Meet/Zoom" plan.
 *
 * This component renders as a dropdown-style popover triggered from the
 * ControlBar's "More" area. It lets the user start/stop local recording
 * and download the result.
 */
import { motion, AnimatePresence } from "motion/react";
import {
  Circle, Square, Download, Trash2, Clock, HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecordingState } from "@/src/hooks/useRecordingAgent";

interface RecordingControlsProps {
  /** Current recording state */
  state: RecordingState;
  /** Start recording with the given streams */
  onStart: () => void;
  /** Stop the active recording */
  onStop: () => void;
  /** Download the last recording */
  onDownload: () => void;
  /** Clear the recording from memory */
  onClear: () => void;
  /** Whether the popover is open */
  isOpen: boolean;
  /** Close the popover */
  onClose: () => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function RecordingControls({
  state,
  onStart,
  onStop,
  onDownload,
  onClear,
  isOpen,
  onClose,
}: RecordingControlsProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Click-away backdrop (transparent) */}
          <div className="fixed inset-0 z-40" onClick={onClose} />

          {/* Popover */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 w-64"
          >
            <div className="bg-ah-surface/95 backdrop-blur-2xl border border-ah-border rounded-2xl shadow-xl shadow-black/10 overflow-hidden ring-1 ring-white/5">
              {/* Header */}
              <div className="px-4 py-3 border-b border-ah-border">
                <div className="flex items-center gap-2">
                  {state.isRecording && (
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-ah-text">
                    {state.isRecording ? "Recording" : state.blob ? "Recording Ready" : "Local Recording"}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Active recording display */}
                {state.isRecording && (
                  <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        {formatElapsed(state.elapsed)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={onStop}
                      className="h-7 px-3 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Stop
                    </Button>
                  </div>
                )}

                {/* Completed recording */}
                {!state.isRecording && state.blob && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-ah-text-muted text-xs">
                      <HardDrive className="h-3.5 w-3.5" />
                      <span>{formatSize(state.blob.size)}</span>
                      <span className="text-ah-text-faint">•</span>
                      <span>{formatElapsed(state.elapsed)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={onDownload}
                        className="flex-1 h-8 bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg"
                      >
                        <Download className="h-3 w-3 mr-1.5" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onClear}
                        className="h-8 px-3 border-ah-border text-ah-text-muted hover:text-red-500 dark:hover:text-red-400 text-xs rounded-lg"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Start button (when idle and no blob) */}
                {!state.isRecording && !state.blob && (
                  <Button
                    onClick={onStart}
                    className="w-full h-9 bg-ah-text hover:bg-ah-text/90 text-ah-bg text-xs font-semibold rounded-xl"
                  >
                    <Circle className="h-3 w-3 mr-1.5 text-red-400" />
                    Start Recording
                  </Button>
                )}

                {/* Info text */}
                <p className="text-[10px] text-ah-text-muted leading-relaxed">
                  Records your mic {state.isRecording ? "and camera " : ""}locally in your browser. 
                  Nothing is uploaded to a server.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
