import React, { createContext, useContext, useState, useRef, useCallback, useMemo, ReactNode } from "react";
import { Socket } from "socket.io-client";
import {
  PeerData, ChatMessage, ActivityEvent, VideoQuality,
  Toast, ToastType, ConnectionHealth, LayoutMode, PanelTab,
} from "../types";

export interface WebRTCMemoryContextValue {
  // ── Existing State ────────────────────────────────────────────────────────
  peers: Map<string, PeerData>;
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  localVideoStream: MediaStream | null;
  isMuted: boolean;
  isSharingScreen: boolean;
  isVideoEnabled: boolean;
  isConnected: boolean;
  chatMessages: ChatMessage[];
  activityLog: ActivityEvent[];
  roomUserCount: number;
  activeSpeakerId: string | null;
  currentCameraId: string | null;
  videoQuality: VideoQuality;
  userRole: "host" | "participant" | "unknown";
  isMutedByHost: boolean;
  isVideoDisabledByHost: boolean;

  // ── Phase 1: New UI State ─────────────────────────────────────────────────
  layoutMode: LayoutMode;
  activePanelTab: PanelTab;
  pinnedPeerId: string | null;
  toasts: Toast[];
  connectionHealth: ConnectionHealth;
  isRecording: boolean;
  unreadChatCount: number;

  // ── Refs for Agent-to-Agent access (Stable Ref pattern) ──────────────────
  socketRef: React.MutableRefObject<Socket | null>;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  screenStreamRef: React.MutableRefObject<MediaStream | null>;
  videoStreamRef: React.MutableRefObject<MediaStream | null>;
  peersRef: React.MutableRefObject<Map<string, PeerData>>;
  iceServersRef: React.MutableRefObject<RTCIceServer[]>;
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  analyserNodesRef: React.MutableRefObject<Map<string, AnalyserNode>>;
  iceCandidateBufferRef: React.MutableRefObject<Map<string, RTCIceCandidateInit[]>>;
  makingOfferRef: React.MutableRefObject<Map<string, boolean>>;
  negotiationDoneRef: React.MutableRefObject<Map<string, boolean>>;
  politeRef: React.MutableRefObject<Map<string, boolean>>;
  ignoreOfferRef: React.MutableRefObject<Map<string, boolean>>;

  // ── Existing Setters ──────────────────────────────────────────────────────
  setPeers: React.Dispatch<React.SetStateAction<Map<string, PeerData>>>;
  setLocalStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  setLocalScreenStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  setLocalVideoStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSharingScreen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVideoEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setRoomUserCount: React.Dispatch<React.SetStateAction<number>>;
  setActiveSpeakerId: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentCameraId: React.Dispatch<React.SetStateAction<string | null>>;
  setVideoQuality: React.Dispatch<React.SetStateAction<VideoQuality>>;
  setUserRole: React.Dispatch<React.SetStateAction<"host" | "participant" | "unknown">>;
  setIsMutedByHost: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVideoDisabledByHost: React.Dispatch<React.SetStateAction<boolean>>;

  // ── Phase 1: New Setters ──────────────────────────────────────────────────
  setLayoutMode: React.Dispatch<React.SetStateAction<LayoutMode>>;
  setActivePanelTab: React.Dispatch<React.SetStateAction<PanelTab>>;
  setPinnedPeerId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectionHealth: React.Dispatch<React.SetStateAction<ConnectionHealth>>;
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
  setUnreadChatCount: React.Dispatch<React.SetStateAction<number>>;

  // ── Helpers ───────────────────────────────────────────────────────────────
  addActivity: (event: ActivityEvent) => void;
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  togglePanelTab: (tab: PanelTab) => void;
}

const WebRTCMemoryContext = createContext<WebRTCMemoryContextValue | null>(null);

/**
 * A stable ref that holds the latest memory value.
 * Agent hooks should use this via useStableMemory() so their
 * useCallback/useEffect dependencies never change identity.
 */
const StableMemoryRefContext = createContext<React.MutableRefObject<WebRTCMemoryContextValue> | null>(null);

const DEFAULT_CONNECTION_HEALTH: ConnectionHealth = {
  state: 'disconnected',
  quality: 'unknown',
  lastChecked: 0,
};

export function WebRTCProvider({ children }: { children: ReactNode }) {
  // ── Existing State ─────────────────────────────────────────────────────────
  const [peers, setPeers] = useState<Map<string, PeerData>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [roomUserCount, setRoomUserCount] = useState(1);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('high');
  const [userRole, setUserRole] = useState<"host" | "participant" | "unknown">("unknown");
  const [isMutedByHost, setIsMutedByHost] = useState<boolean>(false);
  const [isVideoDisabledByHost, setIsVideoDisabledByHost] = useState<boolean>(false);

  // ── Phase 1: New State ─────────────────────────────────────────────────────
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [activePanelTab, setActivePanelTab] = useState<PanelTab>(null);
  const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>(DEFAULT_CONNECTION_HEALTH);
  const [isRecording, setIsRecording] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // ── Refs (Stable Ref pattern — agent hooks use these) ────────────────────
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerData>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodesRef = useRef<Map<string, AnalyserNode>>(new Map());
  const iceCandidateBufferRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const negotiationDoneRef = useRef<Map<string, boolean>>(new Map());
  const politeRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addActivity = useCallback((event: ActivityEvent) => {
    setActivityLog((prev) => [event, ...prev].slice(0, 50));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 10);
    const toast: Toast = { id, type, message, duration, timestamp: Date.now() };
    setToasts((prev) => [...prev.slice(-2), toast]); // max 3 toasts
    // Auto-remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const togglePanelTab = useCallback((tab: PanelTab) => {
    setActivePanelTab((prev) => {
      if (prev === tab) return null; // clicking same tab closes it
      if (tab === 'chat') setUnreadChatCount(0); // clear badge on open
      return tab;
    });
  }, []);

  const value: WebRTCMemoryContextValue = useMemo(() => ({
    // ── State ──────────────────────────────────────────────────────────────
    peers, localStream, localScreenStream, localVideoStream,
    isMuted, isSharingScreen, isVideoEnabled, isConnected,
    chatMessages, activityLog, roomUserCount, activeSpeakerId,
    currentCameraId, videoQuality, userRole, isMutedByHost, isVideoDisabledByHost,
    layoutMode, activePanelTab, pinnedPeerId, toasts, connectionHealth,
    isRecording, unreadChatCount,

    // ── Refs ───────────────────────────────────────────────────────────────
    socketRef, localStreamRef, screenStreamRef, videoStreamRef,
    peersRef, iceServersRef, audioContextRef, analyserNodesRef,
    iceCandidateBufferRef, makingOfferRef, negotiationDoneRef,
    politeRef, ignoreOfferRef,

    // ── Setters ────────────────────────────────────────────────────────────
    setPeers, setLocalStream, setLocalScreenStream, setLocalVideoStream,
    setIsMuted, setIsSharingScreen, setIsVideoEnabled, setIsConnected,
    setChatMessages, setRoomUserCount, setActiveSpeakerId, setCurrentCameraId,
    setVideoQuality, setUserRole, setIsMutedByHost, setIsVideoDisabledByHost,
    setLayoutMode, setActivePanelTab, setPinnedPeerId, setConnectionHealth,
    setIsRecording, setUnreadChatCount,

    // ── Helpers ────────────────────────────────────────────────────────────
    addActivity, addToast, removeToast, togglePanelTab,
  }), [
    peers, localStream, localScreenStream, localVideoStream,
    isMuted, isSharingScreen, isVideoEnabled, isConnected,
    chatMessages, activityLog, roomUserCount, activeSpeakerId,
    currentCameraId, videoQuality, userRole, isMutedByHost, isVideoDisabledByHost,
    layoutMode, activePanelTab, pinnedPeerId, toasts, connectionHealth,
    isRecording, unreadChatCount,
    addActivity, addToast, removeToast, togglePanelTab,
  ]);

  // Stable ref: always holds the latest value, identity never changes.
  // Agent hooks depend on this ref instead of the value object.
  const stableRef = useRef<WebRTCMemoryContextValue>(value);
  stableRef.current = value;

  return (
    <StableMemoryRefContext.Provider value={stableRef}>
      <WebRTCMemoryContext.Provider value={value}>
        {children}
      </WebRTCMemoryContext.Provider>
    </StableMemoryRefContext.Provider>
  );
}

/**
 * Use this in UI components that need to READ reactive state (peers, isMuted, etc).
 * Re-renders the component when state changes.
 */
export function useWebRTCMemory() {
  const context = useContext(WebRTCMemoryContext);
  if (!context) {
    throw new Error("useWebRTCMemory must be used within a WebRTCProvider");
  }
  return context;
}

/**
 * Use this in agent hooks (usePeerAgent, useSignalingAgent, useMediaAgent).
 * Returns a STABLE ref whose .current always has the latest memory.
 * Safe to use in useCallback/useEffect dependency arrays without causing re-runs.
 */
export function useStableMemory() {
  const ref = useContext(StableMemoryRefContext);
  if (!ref) {
    throw new Error("useStableMemory must be used within a WebRTCProvider");
  }
  return ref;
}
