/**
 * PermissionOverlay — missing device / access-denied overlay.
 * Phase 6 — glassmorphism design-token pass. Legacy CSS classes removed.
 */
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldAlert, Mic, Camera, RefreshCw, Settings,
  ExternalLink, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  onRetry: () => void;
  onContinueWithout?: () => void;
  onLeave: () => void;
}

/* ─── Meta by error type ───────────────────────────────────────────────────── */
function getErrorMeta(error: PermissionError) {
  switch (error) {
    case "microphone-denied":
      return {
        icon:              <Mic   size={28} />,
        accent:            "amber",
        title:             "Microphone Access Denied",
        message:           "Audio Hub needs microphone access to let you communicate. Please allow access in your browser settings and try again.",
        canContinueWithout: false,
        helpHref:          "https://support.google.com/chrome/answer/2693767",
        helpText:          "How to enable microphone in Chrome",
        steps: [
          <>Click the <strong className="font-bold text-ah-text">lock icon</strong> in the address bar</>,
          <>Find <strong className="font-bold text-ah-text">Microphone</strong> and set it to <strong className="font-bold text-ah-text">Allow</strong></>,
          <>Click <strong className="font-bold text-ah-text">Retry</strong> below</>,
        ],
      };
    case "camera-denied":
      return {
        icon:              <Camera size={28} />,
        accent:            "violet",
        title:             "Camera Access Denied",
        message:           "Camera access was denied. You can still join with audio only, or grant access and retry.",
        canContinueWithout: true,
        helpHref:          "https://support.google.com/chrome/answer/2693767",
        helpText:          "How to enable camera in Chrome",
        steps: [
          <>Click the <strong className="font-bold text-ah-text">lock icon</strong> in the address bar</>,
          <>Find <strong className="font-bold text-ah-text">Camera</strong> and set it to <strong className="font-bold text-ah-text">Allow</strong></>,
          <>Click <strong className="font-bold text-ah-text">Retry</strong> below</>,
        ],
      };
    case "both-denied":
      return {
        icon:              <ShieldAlert size={28} />,
        accent:            "red",
        title:             "Microphone & Camera Blocked",
        message:           "Both microphone and camera access are blocked. Microphone is required to join. Please update your browser permissions.",
        canContinueWithout: false,
        helpHref:          "https://support.google.com/chrome/answer/2693767",
        helpText:          "How to manage site permissions",
        steps: [
          <>Click the <strong className="font-bold text-ah-text">lock icon</strong> in the address bar</>,
          <>Allow both <strong className="font-bold text-ah-text">Microphone</strong> & <strong className="font-bold text-ah-text">Camera</strong></>,
          <>Click <strong className="font-bold text-ah-text">Retry</strong> below</>,
        ],
      };
    case "microphone-not-found":
      return {
        icon:              <Mic   size={28} />,
        accent:            "amber",
        title:             "No Microphone Found",
        message:           "No microphone was detected on this device. Please plug one in and try again.",
        canContinueWithout: false,
        helpHref:          null,
        helpText:          null,
        steps: [
          <>Connect a microphone via USB or 3.5mm jack</>,
          <>Your OS may need a moment to register it</>,
          <>Click <strong className="font-bold text-ah-text">Retry</strong> below</>,
        ],
      };
    case "camera-not-found":
      return {
        icon:              <Camera size={28} />,
        accent:            "violet",
        title:             "No Camera Found",
        message:           "No camera was detected. You can join with audio only.",
        canContinueWithout: true,
        helpHref:          null,
        helpText:          null,
        steps: [
          <>Connect an external camera or use a built-in one</>,
          <>Click <strong className="font-bold text-ah-text">Retry</strong> or continue without video</>,
        ],
      };
    case "overconstrained":
      return {
        icon:              <Settings size={28} />,
        accent:            "amber",
        title:             "Device Configuration Error",
        message:           "Your selected device doesn't support the required settings. Try a different device in Settings.",
        canContinueWithout: false,
        helpHref:          null,
        helpText:          null,
        steps: [
          <>Open the Settings panel and select a different device</>,
          <>Click <strong className="font-bold text-ah-text">Retry</strong> below</>,
        ],
      };
    default:
      return null;
  }
}

/* ─── Accent tokens ────────────────────────────────────────────────────────── */
const ACCENT = {
  red:    { ring: "bg-red-500/15 text-red-400",    badge: "border-red-500/25 bg-red-500/10 text-red-400" },
  amber:  { ring: "bg-amber-500/15 text-amber-400",  badge: "border-amber-500/25 bg-amber-500/10 text-amber-400" },
  violet: { ring: "bg-violet-500/15 text-violet-400", badge: "border-violet-500/25 bg-violet-500/10 text-violet-400" },
};

/* ─── Component ───────────────────────────────────────────────────────────── */
export function PermissionOverlay({
  error, onRetry, onContinueWithout, onLeave,
}: PermissionOverlayProps) {
  const meta    = getErrorMeta(error);
  const visible = error !== null && meta !== null;

  return (
    <AnimatePresence>
      {visible && meta && (
        <motion.div
          key="permission-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[8999] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label={meta.title}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.92, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="relative z-10 w-full max-w-[440px] bg-ah-surface/90 backdrop-blur-3xl border border-ah-glass-border rounded-3xl shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* top accent glow bar */}
            <div className={cn(
              "h-1 w-full",
              meta.accent === "red"    && "bg-gradient-to-r from-transparent via-red-500/60 to-transparent",
              meta.accent === "amber"  && "bg-gradient-to-r from-transparent via-amber-500/60 to-transparent",
              meta.accent === "violet" && "bg-gradient-to-r from-transparent via-violet-500/60 to-transparent",
            )} />

            <div className="p-7 flex flex-col items-center gap-5 text-center">
              {/* Icon ring */}
              <div className={cn(
                "h-16 w-16 rounded-2xl flex items-center justify-center",
                ACCENT[meta.accent as keyof typeof ACCENT].ring
              )}>
                {meta.icon}
              </div>

              {/* Text */}
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-ah-text">{meta.title}</h2>
                <p className="text-sm leading-relaxed text-ah-text-muted max-w-[36ch] mx-auto">
                  {meta.message}
                </p>
              </div>

              {/* Steps */}
              <div className="w-full bg-ah-glass border border-ah-glass-border rounded-2xl p-4 text-left space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-bold text-ah-text-subtle mb-1">
                  How to fix
                </p>
                <ol className="space-y-2">
                  {meta.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-ah-text-muted">
                      <span className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        ACCENT[meta.accent as keyof typeof ACCENT].badge,
                        "border"
                      )}>
                        {i + 1}
                      </span>
                      <span className="leading-5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Help link */}
              {meta.helpHref && (
                <a
                  href={meta.helpHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] text-ah-text-subtle hover:text-ah-text transition-colors"
                  aria-label={meta.helpText ?? "Permission help"}
                >
                  <ExternalLink className="h-3 w-3" />
                  {meta.helpText}
                </a>
              )}

              {/* Actions */}
              <div className="flex flex-col w-full gap-2 pt-1">
                <button
                  id="permission-retry-btn"
                  onClick={onRetry}
                  className={cn(
                    "flex items-center justify-center gap-2 h-11 w-full rounded-2xl text-sm font-bold text-white transition-all",
                    "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400",
                    "shadow-md shadow-violet-500/25 hover:shadow-violet-500/40"
                  )}
                  aria-label="Retry media access"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>

                {meta.canContinueWithout && onContinueWithout && (
                  <button
                    id="permission-continue-btn"
                    onClick={onContinueWithout}
                    className="flex items-center justify-center gap-2 h-11 w-full rounded-2xl text-sm font-semibold transition-all border border-ah-glass-border bg-ah-glass text-ah-text hover:bg-ah-surface-raised"
                    aria-label="Continue without this device"
                  >
                    Continue Without
                    <ArrowRight className="h-4 w-4 opacity-60" />
                  </button>
                )}

                <button
                  id="permission-leave-btn"
                  onClick={onLeave}
                  className="h-10 w-full rounded-2xl text-sm font-medium text-ah-text-muted hover:text-ah-text transition-colors"
                  aria-label="Leave the room"
                >
                  Leave Room
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
