import { motion, AnimatePresence } from "motion/react";
import { RefreshCw, AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import type { ConnectionHealth } from "@/src/hooks/useConnectionMonitor";

interface ReconnectionOverlayProps {
  health: ConnectionHealth;
  onRetry: () => void;
  onLeave: () => void;
}

const RETRY_COUNTDOWN_S = 10;
const INITIAL_JOIN_GRACE_MS = 12000;
const RECONNECT_GRACE_MS = 2500;

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function ReconnectionOverlay({
  health,
  onRetry,
  onLeave,
}: ReconnectionOverlayProps) {
  const [countdown, setCountdown] = useState(RETRY_COUNTDOWN_S);
  const [isRetrying, setIsRetrying] = useState(false);
  const isFailed = health.state === "failed";
  const graceMs = health.lastConnectedAt ? RECONNECT_GRACE_MS : INITIAL_JOIN_GRACE_MS;
  const visible =
    isFailed ||
    (health.state === "reconnecting" && health.degradedForMs >= graceMs);

  useEffect(() => {
    if (!visible || isFailed) return;

    setCountdown(RETRY_COUNTDOWN_S);
    const id = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          onRetry();
          return RETRY_COUNTDOWN_S;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [visible, isFailed, onRetry]);

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
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative z-10 flex w-full max-w-[420px] flex-col items-center gap-4 rounded-lg border border-ah-border bg-ah-surface p-6 text-center text-ah-text shadow-2xl shadow-black/25"
          >
            <div
              className={
                isFailed
                  ? "flex h-16 w-16 items-center justify-center rounded-full bg-red-500/12 text-red-500"
                  : "flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/12 text-amber-500"
              }
            >
              <motion.div
                animate={isFailed ? {} : { rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                {isFailed ? <AlertTriangle size={30} /> : <WifiOff size={30} />}
              </motion.div>
            </div>

            <div className="space-y-2">
              <h2 className="m-0 text-xl font-bold text-ah-text">
                {isFailed ? "Connection Failed" : "Connection Lost"}
              </h2>
              <p className="m-0 max-w-[34ch] text-sm leading-6 text-ah-text-muted">
                {isFailed
                  ? "We could not reconnect. Check your network, then retry."
                  : "Your connection dropped. Attempting to reconnect..."}
              </p>
            </div>

            {health.degradedForMs > 3000 && (
              <p className="m-0 font-mono text-xs text-ah-text-faint">
                Disconnected for {formatDuration(health.degradedForMs)}
              </p>
            )}

            {!isFailed && (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-500">
                <Loader2 size={14} className="animate-spin" />
                <span>
                  {isRetrying ? "Retrying..." : `Auto-retrying in ${countdown}s`}
                </span>
              </div>
            )}

            {health.degradedPeerIds.length > 0 && (
              <p className="m-0 text-xs text-ah-text-faint">
                {health.degradedPeerIds.length} peer
                {health.degradedPeerIds.length > 1 ? "s" : ""} unreachable
              </p>
            )}

            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ah-text px-4 py-2 text-sm font-semibold text-ah-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                <RefreshCw size={16} />
                {isRetrying ? "Retrying..." : "Retry Now"}
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-ah-border bg-ah-surface-raised px-4 py-2 text-sm font-semibold text-ah-text transition hover:bg-ah-control-hover"
                onClick={onLeave}
              >
                Leave Room
              </button>
            </div>

            {isFailed && (
              <ul className="m-0 flex w-full flex-col gap-1 pl-5 text-left text-xs leading-5 text-ah-text-muted">
                <li>Check your internet connection.</li>
                <li>Disable VPN or proxy if calls are blocked.</li>
                <li>Refresh the room if the server restarted.</li>
              </ul>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
