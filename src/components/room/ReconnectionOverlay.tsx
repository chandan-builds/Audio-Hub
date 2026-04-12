/**
 * ReconnectionOverlay — live connection-health overlay.
 * Phase 6 — completed glassmorphism design-token pass.
 * Logic untouched; only visual layer upgraded.
 */
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw, AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import type { ConnectionHealth } from "@/src/hooks/useConnectionMonitor";
import { cn } from "@/lib/utils";

interface ReconnectionOverlayProps {
  health: ConnectionHealth;
  onRetry: () => void;
  onLeave: () => void;
}

const RETRY_COUNTDOWN_S  = 10;
const INITIAL_JOIN_GRACE_MS = 12000;
const RECONNECT_GRACE_MS    = 2500;

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/* ─── Animated ring ────────────────────────────────────────────────────────── */
function SpinRing({ failed }: { failed: boolean }) {
  const base = "h-16 w-16 rounded-2xl flex items-center justify-center";
  const col  = failed
    ? "bg-red-500/15 text-red-400"
    : "bg-amber-500/15 text-amber-400";

  return (
    <div className={cn(base, col)}>
      <motion.div
        animate={failed ? {} : { rotate: 360 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
      >
        {failed ? <AlertTriangle size={28} /> : <WifiOff size={28} />}
      </motion.div>
    </div>
  );
}

/* ─── Countdown ring ───────────────────────────────────────────────────────── */
function CountdownBadge({ countdown, isRetrying }: { countdown: number; isRetrying: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {isRetrying ? "Retrying…" : `Auto-retry in ${countdown}s`}
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */
export function ReconnectionOverlay({
  health, onRetry, onLeave,
}: ReconnectionOverlayProps) {
  const [countdown,  setCountdown]  = useState(RETRY_COUNTDOWN_S);
  const [isRetrying, setIsRetrying] = useState(false);

  const isFailed = health.state === "failed";
  const graceMs  = health.lastConnectedAt ? RECONNECT_GRACE_MS : INITIAL_JOIN_GRACE_MS;
  const visible  =
    isFailed ||
    (health.state === "reconnecting" && health.degradedForMs >= graceMs);

  /* Auto-countdown while reconnecting */
  useEffect(() => {
    if (!visible || isFailed) return;
    setCountdown(RETRY_COUNTDOWN_S);
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { onRetry(); return RETRY_COUNTDOWN_S; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [visible, isFailed, onRetry]);

  /* Reset on reconnect */
  useEffect(() => {
    if (health.state === "connected") {
      setIsRetrying(false);
      setCountdown(RETRY_COUNTDOWN_S);
    }
  }, [health.state]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setCountdown(RETRY_COUNTDOWN_S);
    onRetry();
  }, [onRetry]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="reconnection-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
          role="alert"
          aria-live="assertive"
          aria-label="Connection problem"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative z-10 w-full max-w-[420px] bg-ah-surface/90 backdrop-blur-3xl border border-ah-glass-border rounded-3xl shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Top glow bar */}
            <div className={cn(
              "h-[2px] w-full",
              isFailed
                ? "bg-gradient-to-r from-transparent via-red-500/70 to-transparent"
                : "bg-gradient-to-r from-transparent via-amber-500/70 to-transparent"
            )} />

            <div className="p-7 flex flex-col items-center gap-5 text-center">
              <SpinRing failed={isFailed} />

              {/* Heading */}
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-ah-text">
                  {isFailed ? "Connection Failed" : "Connection Lost"}
                </h2>
                <p className="text-sm leading-relaxed text-ah-text-muted max-w-[34ch] mx-auto">
                  {isFailed
                    ? "We couldn't reconnect to the room. Check your network, then retry."
                    : "Your connection dropped. Attempting to reconnect…"}
                </p>
              </div>

              {/* Duration */}
              {health.degradedForMs > 3000 && (
                <p className="font-mono text-xs text-ah-text-subtle">
                  Disconnected for {formatDuration(health.degradedForMs)}
                </p>
              )}

              {/* Countdown badge */}
              {!isFailed && (
                <CountdownBadge countdown={countdown} isRetrying={isRetrying} />
              )}

              {/* Unreachable peers */}
              {health.degradedPeerIds.length > 0 && (
                <p className="text-xs text-ah-text-subtle">
                  {health.degradedPeerIds.length} peer
                  {health.degradedPeerIds.length > 1 ? "s" : ""} unreachable
                </p>
              )}

              {/* Troubleshoot tips (failed only) */}
              {isFailed && (
                <ul className="w-full space-y-1.5 text-left text-xs text-ah-text-muted bg-ah-glass border border-ah-glass-border rounded-2xl p-4">
                  {[
                    "Check your internet connection.",
                    "Disable VPN or proxy if calls are blocked.",
                    "Refresh the page if the server restarted.",
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 text-red-400 shrink-0">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              )}

              {/* Actions */}
              <div className="flex flex-col w-full gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className={cn(
                    "flex items-center justify-center gap-2 h-11 w-full rounded-2xl text-sm font-bold text-white transition-all",
                    "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400",
                    "shadow-md shadow-violet-500/25 hover:shadow-violet-500/40",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  )}
                >
                  <RefreshCw className="h-4 w-4" />
                  {isRetrying ? "Retrying…" : "Retry Now"}
                </button>

                <button
                  type="button"
                  onClick={onLeave}
                  className="flex items-center justify-center h-11 w-full rounded-2xl text-sm font-semibold border border-ah-glass-border bg-ah-glass text-ah-text hover:bg-ah-surface-raised transition-all"
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
