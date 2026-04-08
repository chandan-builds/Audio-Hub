// src/components/room/RoomScreen.tsx
import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebRTCCoordinator, useWebRTCMemory } from "@/src/hooks/useWebRTC";
import { ActivitySidebar } from "../activity";
import { ChatPanel } from "../chat";
import { DeviceSelector } from "../devices";
import { RoomHeader } from "./RoomHeader";
import { ControlBar } from "./ControlBar";
import { ParticipantGrid } from "./ParticipantGrid";
import { ScreenShareView } from "./ScreenShareView";

// A 1-sample silent WAV file to keep media sessions active in the background
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

interface RoomScreenProps {
  roomId: string;
  userName: string;
  userId: string;
  serverUrl: string;
  onLeave: () => void;
}

export function RoomScreen({ roomId, userName, userId, serverUrl, onLeave }: RoomScreenProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [deviceSelectorOpen, setDeviceSelectorOpen] = useState(false);

  // Read state from context memory
  const {
    peers,
    isConnected,
    isMuted,
    isSharingScreen,
    localStream,
    chatMessages: messages,
    activityLog,
  } = useWebRTCMemory();

  // Initialize and get methods from coordinator
  const {
    toggleMute,
    toggleScreenShare,
    sendChatMessage: sendMessage,
    switchAudioDevice,
  } = useWebRTCCoordinator({ roomId, userName, userId, serverUrl });

  const peerArray = Array.from(peers.entries()) as [string, typeof peers extends Map<any, infer I> ? I : any][];
  const roomUserCount = 1 + peerArray.length; // Local user + peers
  
  // Find the first peer sharing their screen, if any
  const sharingPeer = peerArray.find(([_, peer]) => peer.screenStream != null);

  // Play a silent audio loop to prevent mobile browsers (like Chrome on Android) 
  // from suspending the microphone stream when the app goes to the background.
  const silentAudioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (silentAudioRef.current) {
      silentAudioRef.current.volume = 0.01; // tiny volume so it doesn't trigger noise, but not 0 so it counts as active
      silentAudioRef.current.play().catch(() => {
        // Autoplay policy blocked it, wait for interaction
        const startOnInteract = () => {
          silentAudioRef.current?.play().catch(e => console.log('Background sleep preventer error:', e));
          document.removeEventListener('click', startOnInteract);
          document.removeEventListener('touchstart', startOnInteract);
        };
        document.addEventListener('click', startOnInteract);
        document.addEventListener('touchstart', startOnInteract);
      });
    }
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#09090b] text-white selection:bg-violet-500/30 font-sans">
      {/* Background media preventer */}
      <audio ref={silentAudioRef} src={SILENT_AUDIO_URI} loop playsInline className="hidden" />
      {/* Background gradients for atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-900/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/10 rounded-full blur-[150px]" />
      </div>

      <div className="flex flex-col flex-1 min-w-0 relative z-10">
        <RoomHeader
          roomId={roomId}
          userName={userName}
          isConnected={isConnected}
          roomUserCount={roomUserCount}
          peerArray={peerArray}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen(!chatOpen)}
          onLeave={onLeave}
        />

        <main className="flex-1 overflow-hidden relative flex flex-col p-4 md:p-6 pb-28">
          {sharingPeer ? (
             <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-0">
                {/* Main Screen Share Area */}
                <div className="flex-[3] min-w-0 flex flex-col">
                  <ScreenShareView 
                    stream={sharingPeer[1].screenStream!} 
                    userName={sharingPeer[1].userName} 
                    isMuted={sharingPeer[1].isMuted} 
                  />
                </div>
                {/* Minimized Grid */}
                <ScrollArea className="flex-1 min-w-[300px] xl:max-w-[360px] pb-10">
                   <ParticipantGrid
                    localUserName={userName}
                    isMuted={isMuted}
                    isSharingScreen={isSharingScreen}
                    localStream={localStream}
                    peerArray={peerArray}
                   />
                </ScrollArea>
             </div>
          ) : (
             <ScrollArea className="flex-1 h-full flex flex-col">
               <div className="h-full flex flex-col py-4">
                  <ParticipantGrid
                    localUserName={userName}
                    isMuted={isMuted}
                    isSharingScreen={isSharingScreen}
                    localStream={localStream}
                    peerArray={peerArray}
                  />
               </div>
             </ScrollArea>
          )}
        </main>

        <ControlBar
          isMuted={isMuted}
          isSharingScreen={isSharingScreen}
          onToggleMute={toggleMute}
          onToggleScreenShare={toggleScreenShare}
          onLeave={onLeave}
          onOpenDeviceSelector={() => setDeviceSelectorOpen(true)}
        />
      </div>

      <ActivitySidebar activityLog={activityLog} roomUserCount={roomUserCount} />

      <ChatPanel
        messages={messages}
        onSendMessage={sendMessage}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
      />

      <DeviceSelector
        isOpen={deviceSelectorOpen}
        onClose={() => setDeviceSelectorOpen(false)}
        onSelectDevice={switchAudioDevice}
      />
    </div>
  );
}
