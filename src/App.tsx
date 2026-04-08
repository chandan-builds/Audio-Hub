import { useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LobbyScreen } from "./components/LobbyScreen";
import { RoomScreen } from "./components/RoomScreen";
import { WebRTCProvider } from "./hooks/useWebRTC";

// Server URL — in production, this points to your Render deployment
const SERVER_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:10000";

export default function App() {
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [userId] = useState(() => Math.random().toString(36).substring(2, 10));

  // Check for room ID in URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      setRoomId(room);
    }
  }, []);

  const handleJoinRoom = (room: string, name: string) => {
    setRoomId(room);
    setUserName(name);
    setInRoom(true);

    // Update URL with room param
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    window.history.pushState({}, "", url.toString());
  };

  const handleLeaveRoom = () => {
    setInRoom(false);

    // Remove room param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.pushState({}, "", url.toString());
  };

  return (
    <TooltipProvider>
      <div className="dark min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-zinc-800 selection:text-zinc-100">
        {!inRoom ? (
          <LobbyScreen onJoinRoom={handleJoinRoom} />
        ) : (
          <WebRTCProvider>
            <RoomScreen
              roomId={roomId}
              userName={userName}
              userId={userId}
              serverUrl={SERVER_URL}
              onLeave={handleLeaveRoom}
            />
          </WebRTCProvider>
        )}
      </div>
    </TooltipProvider>
  );
}
