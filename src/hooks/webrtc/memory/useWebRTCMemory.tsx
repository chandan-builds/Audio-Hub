import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";
import { Socket } from "socket.io-client";
import { PeerData, ChatMessage, ActivityEvent } from "../types";

export interface WebRTCMemoryContextValue {
  // State
  peers: Map<string, PeerData>;
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  isMuted: boolean;
  isSharingScreen: boolean;
  isConnected: boolean;
  chatMessages: ChatMessage[];
  activityLog: ActivityEvent[];
  roomUserCount: number;

  // Refs for logic internal tracking (Agent to Agent access)
  socketRef: React.MutableRefObject<Socket | null>;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  screenStreamRef: React.MutableRefObject<MediaStream | null>;
  peersRef: React.MutableRefObject<Map<string, PeerData>>;
  iceServersRef: React.MutableRefObject<RTCIceServer[]>;
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  analyserNodesRef: React.MutableRefObject<Map<string, AnalyserNode>>;
  iceCandidateBufferRef: React.MutableRefObject<Map<string, RTCIceCandidateInit[]>>;
  makingOfferRef: React.MutableRefObject<Map<string, boolean>>;
  negotiationDoneRef: React.MutableRefObject<Map<string, boolean>>;
  politeRef: React.MutableRefObject<Map<string, boolean>>;
  ignoreOfferRef: React.MutableRefObject<Map<string, boolean>>;

  // Setters
  setPeers: React.Dispatch<React.SetStateAction<Map<string, PeerData>>>;
  setLocalStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  setLocalScreenStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSharingScreen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setRoomUserCount: React.Dispatch<React.SetStateAction<number>>;
  
  // Helpers
  addActivity: (event: ActivityEvent) => void;
}

const WebRTCMemoryContext = createContext<WebRTCMemoryContextValue | null>(null);

export function WebRTCProvider({ children }: { children: ReactNode }) {
  const [peers, setPeers] = useState<Map<string, PeerData>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [roomUserCount, setRoomUserCount] = useState(1);

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerData>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodesRef = useRef<Map<string, AnalyserNode>>(new Map());
  const iceCandidateBufferRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const negotiationDoneRef = useRef<Map<string, boolean>>(new Map());
  const politeRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());

  const addActivity = useCallback((event: ActivityEvent) => {
    setActivityLog((prev) => [event, ...prev].slice(0, 50));
  }, []);

  const value: WebRTCMemoryContextValue = {
    peers,
    localStream,
    localScreenStream,
    isMuted,
    isSharingScreen,
    isConnected,
    chatMessages,
    activityLog,
    roomUserCount,
    
    socketRef,
    localStreamRef,
    screenStreamRef,
    peersRef,
    iceServersRef,
    audioContextRef,
    analyserNodesRef,
    iceCandidateBufferRef,
    makingOfferRef,
    negotiationDoneRef,
    politeRef,
    ignoreOfferRef,

    setPeers,
    setLocalStream,
    setLocalScreenStream,
    setIsMuted,
    setIsSharingScreen,
    setIsConnected,
    setChatMessages,
    setRoomUserCount,
    addActivity,
  };

  return (
    <WebRTCMemoryContext.Provider value={value}>
      {children}
    </WebRTCMemoryContext.Provider>
  );
}

export function useWebRTCMemory() {
  const context = useContext(WebRTCMemoryContext);
  if (!context) {
    throw new Error("useWebRTCMemory must be used within a WebRTCProvider");
  }
  return context;
}
