import { useRef, useEffect, useCallback } from "react";

/**
 * useVisibilityPause — pauses/resumes a video track based on whether
 * the element is visible in the viewport (IntersectionObserver).
 * 
 * This prevents the browser from decoding off-screen video frames,
 * significantly reducing CPU/GPU usage in rooms with 10+ participants.
 * 
 * Usage:
 *   const { containerRef } = useVisibilityPause(stream);
 *   return <div ref={containerRef}>...</div>
 */
export function useVisibilityPause(stream: MediaStream | null | undefined) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(true);

  const toggleTracks = useCallback((enabled: boolean) => {
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      // Only touch tracks we're receiving (not local tracks we're sending)
      if (track.readyState === "live") {
        track.enabled = enabled;
      }
    });
  }, [stream]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !stream) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        if (visible !== isVisibleRef.current) {
          isVisibleRef.current = visible;
          toggleTracks(visible);
        }
      },
      {
        // Pause when less than 10% visible (generous threshold)
        threshold: 0.1,
        // Start observing slightly before the element enters viewport
        rootMargin: "100px",
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      // Always re-enable tracks on unmount so other consumers aren't affected
      toggleTracks(true);
    };
  }, [stream, toggleTracks]);

  return { containerRef };
}
