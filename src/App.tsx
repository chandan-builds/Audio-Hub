import { useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
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
      <div className="dark min-h-[100dvh] bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-zinc-800 selection:text-zinc-100">
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

        {/* Developer Signature Stamp */}
        <a 
          href="https://github.com/chandan-builds" 
          target="_blank" 
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 hidden md:flex items-center gap-2.5 rounded-full border border-white/5 bg-[#0a0a0a]/60 px-4 py-2 text-xs font-medium backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] cursor-pointer group"
        >
          <span className="text-zinc-400 transition-colors group-hover:text-zinc-200">Built by</span>
          <span className="font-bold tracking-wide bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent group-hover:from-indigo-300 group-hover:via-purple-300 group-hover:to-pink-300 transition-colors">
            chandan-builds
          </span>
          <Sparkles className="w-3.5 h-3.5 text-purple-400 opacity-70 group-hover:opacity-100 group-hover:text-pink-300 transition-all duration-300" />
        </a>
      </div>
    </TooltipProvider>
  );
}
