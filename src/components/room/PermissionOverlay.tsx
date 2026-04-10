import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, Mic, Camera, RefreshCw, Settings, ExternalLink } from "lucide-react";

export type PermissionError =
  | "microphone-denied"
  | "camera-denied"
  | "both-denied"
  | "microphone-not-found"
  | "camera-not-found"
  | "overconstrained"
  | null;

interface PermissionOverlayProps {
  error: PermissionError;
  /** Called when user wants to retry acquiring media */
  onRetry: () => void;
  /** Called when user decides to continue without the denied device */
  onContinueWithout?: () => void;
  /** Called to leave the room entirely */
  onLeave: () => void;
}

function getErrorMeta(error: PermissionError) {
  switch (error) {
    case "microphone-denied":
      return {
        icon: <Mic size={32} />,
        title: "Microphone Access Denied",
        message:
          "Audio Hub needs microphone access to let you communicate. Please allow access in your browser settings and try again.",
        canContinueWithout: false,
        helpHref: "https://support.google.com/chrome/answer/2693767",
        helpText: "How to enable microphone in Chrome",
      };
    case "camera-denied":
      return {
        icon: <Camera size={32} />,
        title: "Camera Access Denied",
        message:
          "Camera access was denied. You can still join with audio only, or grant access and retry.",
        canContinueWithout: true,
        helpHref: "https://support.google.com/chrome/answer/2693767",
        helpText: "How to enable camera in Chrome",
      };
    case "both-denied":
      return {
        icon: <ShieldAlert size={32} />,
        title: "Microphone & Camera Blocked",
        message:
          "Both microphone and camera access are blocked. Microphone is required to join the room. Please update your browser permissions.",
        canContinueWithout: false,
        helpHref: "https://support.google.com/chrome/answer/2693767",
        helpText: "How to manage site permissions",
      };
    case "microphone-not-found":
      return {
        icon: <Mic size={32} />,
        title: "No Microphone Found",
        message:
          "We couldn't detect a microphone on your device. Please plug in a microphone and try again.",
        canContinueWithout: false,
        helpHref: null,
        helpText: null,
      };
    case "camera-not-found":
      return {
        icon: <Camera size={32} />,
        title: "No Camera Found",
        message:
          "No camera was detected. You can join with audio only.",
        canContinueWithout: true,
        helpHref: null,
        helpText: null,
      };
    case "overconstrained":
      return {
        icon: <Settings size={32} />,
        title: "Device Configuration Error",
        message:
          "Your selected device doesn't support the required audio settings. Please try a different device.",
        canContinueWithout: false,
        helpHref: null,
        helpText: null,
      };
    default:
      return null;
  }
}

export function PermissionOverlay({
  error,
  onRetry,
  onContinueWithout,
  onLeave,
}: PermissionOverlayProps) {
  const meta = getErrorMeta(error);
  const visible = error !== null && meta !== null;

  return (
    <AnimatePresence>
      {visible && meta && (
        <motion.div
          key="permission-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="permission-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-label={meta.title}
        >
          <div className="permission-backdrop" />

          <motion.div
            className="permission-card"
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {/* Icon */}
            <div className="permission-icon-wrap">
              {meta.icon}
            </div>

            {/* Title */}
            <h2 className="permission-title">{meta.title}</h2>

            {/* Message */}
            <p className="permission-message">{meta.message}</p>

            {/* Browser permission steps */}
            <div className="permission-steps">
              <p className="permission-steps-label">To fix this:</p>
              <ol className="permission-steps-list">
                <li>Click the <strong>lock icon</strong> in your browser's address bar</li>
                <li>Find <strong>Microphone</strong>{error?.includes("camera") ? " & Camera" : ""}</li>
                <li>Change permission to <strong>Allow</strong></li>
                <li>Click <strong>Retry</strong> below</li>
              </ol>
            </div>

            {/* External help link */}
            {meta.helpHref && (
              <a
                href={meta.helpHref}
                target="_blank"
                rel="noopener noreferrer"
                className="permission-help-link"
                aria-label={meta.helpText ?? "Permission help"}
              >
                <ExternalLink size={14} />
                {meta.helpText}
              </a>
            )}

            {/* Actions */}
            <div className="permission-actions">
              <button
                id="permission-retry-btn"
                className="permission-btn primary"
                onClick={onRetry}
                aria-label="Retry media access"
              >
                <RefreshCw size={16} />
                Retry
              </button>

              {meta.canContinueWithout && onContinueWithout && (
                <button
                  id="permission-continue-btn"
                  className="permission-btn secondary"
                  onClick={onContinueWithout}
                  aria-label="Continue without this device"
                >
                  Continue Without
                </button>
              )}

              <button
                id="permission-leave-btn"
                className="permission-btn ghost"
                onClick={onLeave}
                aria-label="Leave the room"
              >
                Leave Room
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
