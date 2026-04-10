import { motion, AnimatePresence } from "motion/react";
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import type { ConnectionHealth } from "@/src/hooks/useConnectionMonitor";

interface ReconnectionOverlayProps {
  health: ConnectionHealth;
  /** Called when user clicks "Retry Now" */
  onRetry: () => void;
  /** Called when user gives up and leaves the room */
  onLeave: () => void;
}

const RETRY_COUNTDOWN_S = 10;

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function ReconnectionOverlay({ health, onRetry, onLeave }: ReconnectionOverlayProps) {
  const [countdown, setCountdown] = useState(RETRY_COUNTDOWN_S);
  const [isRetrying, setIsRetrying] = useState(false);

  const visible = health.state === "reconnecting" || health.state === "failed";

  // Countdown auto-retry
  useEffect(() => {
    if (!visible || health.state === "failed") return;

    setCountdown(RETRY_COUNTDOWN_S);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          onRetry();
          return RETRY_COUNTDOWN_S;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [visible, health.state, onRetry]);

  // Reset retry spinner once health resolves
  useEffect(() => {
    if (health.state === "connected") {
      setIsRetrying(false);
    }
  }, [health.state]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setCountdown(RETRY_COUNTDOWN_S);
    onRetry();
  }, [onRetry]);

  const isFailed = health.state === "failed";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="reconnection-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="reconnection-overlay"
          role="alert"
          aria-live="assertive"
          aria-label="Connection lost, attempting to reconnect"
        >
          {/* Blurred glass background */}
          <div className="reconnection-backdrop" />

          <motion.div
            className="reconnection-card"
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {/* Icon */}
            <div className={`reconnection-icon-wrap ${isFailed ? "failed" : "reconnecting"}`}>
              <motion.div
                animate={isFailed ? {} : { rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                {isFailed ? (
                  <AlertTriangle size={32} />
                ) : (
                  <WifiOff size={32} />
                )}
              </motion.div>
            </div>

            {/* Title & message */}
            <h2 className="reconnection-title">
              {isFailed ? "Connection Failed" : "Connection Lost"}
            </h2>
            <p className="reconnection-message">
              {isFailed
                ? "We couldn't reconnect. This may be due to a network change or server issue."
                : `Your connection dropped. Attempting to reconnect…`}
            </p>

            {/* Degraded duration */}
            {health.degradedForMs > 3000 && (
              <p className="reconnection-duration">
                Disconnected for {formatDuration(health.degradedForMs)}
              </p>
            )}

            {/* Auto-retry countdown pill */}
            {!isFailed && (
              <div className="reconnection-countdown">
                <Loader2 size={14} className="reconnection-spinner" />
                <span>
                  {isRetrying
                    ? "Retrying…"
                    : `Auto-retrying in ${countdown}s`}
                </span>
              </div>
            )}

            {/* Connection quality context — only when multi-peer failure */}
            {health.degradedPeerIds.length > 0 && (
              <p className="reconnection-subtext">
                {health.degradedPeerIds.length} peer{health.degradedPeerIds.length > 1 ? "s" : ""} unreachable
              </p>
            )}

            {/* Actions */}
            <div className="reconnection-actions">
              <button
                id="reconnection-retry-btn"
                className="reconnection-btn primary"
                onClick={handleRetry}
                disabled={isRetrying}
                aria-label="Retry connection now"
              >
                <RefreshCw size={16} />
                {isRetrying ? "Retrying…" : "Retry Now"}
              </button>
              <button
                id="reconnection-leave-btn"
                className="reconnection-btn secondary"
                onClick={onLeave}
                aria-label="Leave the room"
              >
                Leave Room
              </button>
            </div>

            {/* Network quality tips */}
            {isFailed && (
              <ul className="reconnection-tips">
                <li>Check your internet connection</li>
                <li>Try disabling VPN or proxy</li>
                <li>Move closer to your Wi-Fi router</li>
              </ul>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
