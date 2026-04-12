import { MediaPresentation } from "../types";

/**
 * Computes a deterministic MediaPresentation from classified streams and
 * the peer's signaled source flags.
 *
 * Rules (priority order):
 *  1. Screen share active + screenStream present → primarySource = "screen"
 *     Camera stream (if any) becomes secondary (PiP).
 *  2. Camera active + cameraStream present → primarySource = "camera"
 *     No secondary.
 *  3. No active source / no stream → primarySource = "none"
 *
 * This is the ONLY place in the codebase that produces a MediaPresentation.
 * Never inline this logic; always call computePresentation().
 */
export function computePresentation(
  cameraStream: MediaStream | null,
  screenStream: MediaStream | null,
  isSharingScreen: boolean,
): MediaPresentation {
  if (isSharingScreen && screenStream) {
    return {
      primaryStream: screenStream,
      secondaryStream: cameraStream, // null is OK — PiP only shown when non-null
      primarySource: "screen",
    };
  }
  if (cameraStream) {
    return {
      primaryStream: cameraStream,
      secondaryStream: null,
      primarySource: "camera",
    };
  }
  return {
    primaryStream: null,
    secondaryStream: null,
    primarySource: "none",
  };
}

/** The empty / initial presentation value. Use this for PeerData construction. */
export const EMPTY_PRESENTATION: MediaPresentation = {
  primaryStream: null,
  secondaryStream: null,
  primarySource: "none",
};
