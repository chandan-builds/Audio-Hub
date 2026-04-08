// src/components/room/ParticipantGrid.tsx
import { PeerCard } from "./PeerCard";
import { EmptyRoom } from "./EmptyRoom";
import type { PeerData } from "@/src/hooks/useWebRTC";
import { cn } from "@/lib/utils";

interface ParticipantGridProps {
  localUserName: string;
  isMuted: boolean;
  isSharingScreen: boolean;
  localStream: MediaStream | null;
  peerArray: [string, PeerData][];
}

export function ParticipantGrid({
  localUserName,
  isMuted,
  isSharingScreen,
  localStream,
  peerArray,
}: ParticipantGridProps) {
  const totalParticipants = 1 + peerArray.length;
  
  // Calculate grid layout based on count
  let gridCols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  if (totalParticipants === 1) gridCols = "flex justify-center items-center h-full";
  else if (totalParticipants === 2) gridCols = "grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto w-full";
  else if (totalParticipants <= 4) gridCols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 max-w-5xl mx-auto w-full";
  else if (totalParticipants <= 6) gridCols = "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto w-full";

  return (
    <div className={cn(
      totalParticipants === 1 ? "flex-1" : "grid gap-6 auto-rows-max h-fit",
      gridCols
    )}>
      {/* Local User */}
      <div className={cn(totalParticipants === 1 ? "w-full max-w-md mx-auto" : "")}>
        <PeerCard
          peer={{
            userId: "local",
            userName: localUserName,
            isMuted,
            isSharingScreen,
            audioLevel: 0,
            connectionState: "connected",
          } as unknown as PeerData}
          isLocal
          localUserName={localUserName}
          isMuted={isMuted}
          isSharingScreen={isSharingScreen}
          localStream={localStream}
        />
      </div>

      {/* Remote Peers */}
      {peerArray.map(([id, peer]) => (
        <PeerCard key={id} peer={peer} />
      ))}
    </div>
  );
}
