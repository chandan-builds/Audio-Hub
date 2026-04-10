import { useEffect, useRef, useState, useCallback } from "react";
import type { PeerData } from "@/src/hooks/webrtc/types";

export type ConnectionQuality = "excellent" | "good" | "poor" | "critical";
export type ConnectionState = "connected" | "reconnecting" | "disconnected" | "failed";

export interface ConnectionHealth {
  state: ConnectionState;
  quality: ConnectionQuality;
  /** Worst-case ICE state across all peers */
  worstIceState: RTCIceConnectionState | null;
  /** Peers that are currently struggling */
  degradedPeerIds: string[];
  /** Time of last successful connection (ms epoch) */
  lastConnectedAt: number | null;
  /** How long we've been in a degraded state (ms) */
  degradedForMs: number;
}

const INITIAL_HEALTH: ConnectionHealth = {
  state: "connected",
  quality: "excellent",
  worstIceState: null,
  degradedPeerIds: [],
  lastConnectedAt: null,
  degradedForMs: 0,
};

/**
 * Derives a ConnectionHealth snapshot from the current set of peers and
 * the socket.io connection flag. Called on every peer map change.
 */
function deriveHealth(
  peers: Map<string, PeerData>,
  isSignalingConnected: boolean,
  degradedSince: number | null,
  lastConnectedAt: number | null,
): ConnectionHealth {
  if (!isSignalingConnected) {
    return {
      state: "reconnecting",
      quality: "critical",
      worstIceState: null,
      degradedPeerIds: [],
      lastConnectedAt,
      degradedForMs: degradedSince ? Date.now() - degradedSince : 0,
    };
  }

  if (peers.size === 0) {
    // Alone in the room — connection is "fine" (no peers yet)
    return {
      state: "connected",
      quality: "excellent",
      worstIceState: null,
      degradedPeerIds: [],
      lastConnectedAt: lastConnectedAt ?? Date.now(),
      degradedForMs: 0,
    };
  }

  const degradedPeerIds: string[] = [];
  let worstRank = 0; // 0=excellent, 1=good, 2=poor, 3=critical
  let worstState: RTCIceConnectionState = "connected";

  const iceRank: Record<RTCIceConnectionState, number> = {
    new: 0,
    checking: 1,
    connected: 0,
    completed: 0,
    disconnected: 2,
    failed: 3,
    closed: 3,
  };

  peers.forEach((peer, id) => {
    const rank = iceRank[peer.connectionState] ?? 0;
    if (rank > 0) degradedPeerIds.push(id);
    if (rank > worstRank) {
      worstRank = rank;
      worstState = peer.connectionState;
    }
  });

  const qualityMap: Record<number, ConnectionQuality> = {
    0: "excellent",
    1: "good",
    2: "poor",
    3: "critical",
  };

  const stateMap: Record<number, ConnectionState> = {
    0: "connected",
    1: "connected",
    2: "reconnecting",
    3: "failed",
  };

  return {
    state: stateMap[worstRank],
    quality: qualityMap[worstRank],
    worstIceState: worstState,
    degradedPeerIds,
    lastConnectedAt: lastConnectedAt ?? (worstRank === 0 ? Date.now() : null),
    degradedForMs: degradedSince ? Date.now() - degradedSince : 0,
  };
}

interface UseConnectionMonitorOptions {
  peers: Map<string, PeerData>;
  isSignalingConnected: boolean;
  /** Called when health state transitions to 'failed' */
  onFailed?: () => void;
  /** Called when health recovers back to 'connected' after being degraded */
  onRecovered?: () => void;
}

/**
 * `useConnectionMonitor`
 *
 * Aggregates ICE connection states across all peers + signaling state into a
 * single `ConnectionHealth` object. Fires `onFailed` / `onRecovered` callbacks
 * on state transitions so the UI can show overlays without polling.
 */
export function useConnectionMonitor({
  peers,
  isSignalingConnected,
  onFailed,
  onRecovered,
}: UseConnectionMonitorOptions) {
  const [health, setHealth] = useState<ConnectionHealth>(INITIAL_HEALTH);

  // Track when degradation started (for degradedForMs)
  const degradedSinceRef = useRef<number | null>(null);
  const lastConnectedAtRef = useRef<number | null>(null);
  const prevStateRef = useRef<ConnectionState>("connected");

  // Callbacks via refs so effect doesn't need them as deps
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;
  const onRecoveredRef = useRef(onRecovered);
  onRecoveredRef.current = onRecovered;

  useEffect(() => {
    const newHealth = deriveHealth(
      peers,
      isSignalingConnected,
      degradedSinceRef.current,
      lastConnectedAtRef.current,
    );

    const prevState = prevStateRef.current;
    const nextState = newHealth.state;

    // Track degradation onset
    if (prevState === "connected" && nextState !== "connected") {
      degradedSinceRef.current = Date.now();
    }

    // Track recovery
    if (prevState !== "connected" && nextState === "connected") {
      degradedSinceRef.current = null;
      lastConnectedAtRef.current = Date.now();
      onRecoveredRef.current?.();
    }

    // Track failure
    if (prevState !== "failed" && nextState === "failed") {
      onFailedRef.current?.();
    }

    // Track last-connected timestamp
    if (nextState === "connected") {
      lastConnectedAtRef.current = Date.now();
    }

    prevStateRef.current = nextState;
    setHealth(newHealth);
  }, [peers, isSignalingConnected]);

  // Ticker to update degradedForMs while in a degraded state
  useEffect(() => {
    if (health.state === "connected") return;

    const id = setInterval(() => {
      setHealth((prev) => ({
        ...prev,
        degradedForMs: degradedSinceRef.current
          ? Date.now() - degradedSinceRef.current
          : 0,
      }));
    }, 1000);

    return () => clearInterval(id);
  }, [health.state]);

  /** Force-refresh health (e.g. after a manual retry) */
  const refresh = useCallback(() => {
    setHealth(
      deriveHealth(peers, isSignalingConnected, degradedSinceRef.current, lastConnectedAtRef.current)
    );
  }, [peers, isSignalingConnected]);

  return { health, refresh };
}
