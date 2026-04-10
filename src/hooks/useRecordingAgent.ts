/**
 * useRecordingAgent — Local-only media recording via MediaRecorder API.
 *
 * Captures whichever streams are active (mic, camera, screen) into a
 * single WebM blob. Exposes start / stop / download controls and a
 * reactive elapsed-time counter for the TopBar recording indicator.
 *
 * Phase 5.3 of the "Beyond Meet/Zoom" plan.
 */
import { useState, useRef, useCallback, useEffect } from "react";

export interface RecordingState {
  /** Whether a recording session is currently in progress */
  isRecording: boolean;
  /** Seconds elapsed since recording started */
  elapsed: number;
  /** The completed blob once the recording has stopped (null while recording or before start) */
  blob: Blob | null;
}

export interface UseRecordingAgentReturn extends RecordingState {
  /** Start capturing streams */
  startRecording: (streams: MediaStream[]) => void;
  /** Stop the active recording session, producing a downloadable blob */
  stopRecording: () => void;
  /** Trigger a browser download of the last recording */
  downloadRecording: (filename?: string) => void;
  /** Clear the blob from memory */
  clearRecording: () => void;
}

/**
 * Merge multiple MediaStreams into one canvas-free stream by combining
 * their audio and video tracks. The MediaRecorder records this combined stream.
 */
function mergeStreams(streams: MediaStream[]): MediaStream {
  const merged = new MediaStream();
  for (const s of streams) {
    for (const track of s.getTracks()) {
      merged.addTrack(track);
    }
  }
  return merged;
}

/** Find the best supported MIME type for MediaRecorder */
function getSupportedMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "video/webm"; // fallback
}

export function useRecordingAgent(): UseRecordingAgentReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Elapsed time ticker
  useEffect(() => {
    if (isRecording) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  const startRecording = useCallback((streams: MediaStream[]) => {
    if (streams.length === 0) {
      console.warn("[Recording] No streams to record");
      return;
    }

    // Clear previous recording
    setBlob(null);
    chunksRef.current = [];
    setElapsed(0);

    const merged = mergeStreams(streams);
    const mimeType = getSupportedMimeType();

    try {
      const recorder = new MediaRecorder(merged, {
        mimeType,
        videoBitsPerSecond: 2_500_000, // 2.5 Mbps — decent quality for small rooms
        audioBitsPerSecond: 128_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mimeType });
        setBlob(finalBlob);
        setIsRecording(false);
        console.info(`[Recording] Stopped — ${(finalBlob.size / 1024 / 1024).toFixed(1)} MB`);
      };

      recorder.onerror = (event) => {
        console.error("[Recording] MediaRecorder error:", event);
        setIsRecording(false);
      };

      // Request data every 1 second for resilience (chunks saved even if tab crashes)
      recorder.start(1000);
      recorderRef.current = recorder;
      setIsRecording(true);
      console.info(`[Recording] Started — MIME: ${mimeType}`);
    } catch (err) {
      console.error("[Recording] Failed to create MediaRecorder:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
  }, []);

  const downloadRecording = useCallback((filename?: string) => {
    if (!blob) return;

    const hasVideo = blob.type.startsWith("video/");
    const ext = hasVideo ? "webm" : "webm";
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const name = filename || `audio-hub-recording-${ts}.${ext}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [blob]);

  const clearRecording = useCallback(() => {
    setBlob(null);
    chunksRef.current = [];
    setElapsed(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, []);

  return {
    isRecording,
    elapsed,
    blob,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
  };
}
