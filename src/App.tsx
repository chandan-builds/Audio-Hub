import { useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import { PreJoinScreen, JoinPreferences } from "./components/prejoin/PreJoinScreen";
import { RoomScreen } from "./components/RoomScreen";
import { WebRTCProvider } from "./hooks/useWebRTC";
import { ThemeProvider } from "./components/ThemeProvider";

// Server URL — in production, this points to your Render deployment
const SERVER_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:10000";

export default function App() {
  const [inRoom, setInRoom]         = useState(false);
  const [roomId, setRoomId]         = useState("");
  const [userName, setUserName]     = useState("");
  const [joinPrefs, setJoinPrefs]   = useState<JoinPreferences | null>(null);
  const [userId]                    = useState(() => Math.random().toString(36).substring(2, 10));

  // Pre-populate room ID from URL query param
  const [initialRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") ?? "";
  });

  const handleJoinRoom = (room: string, name: string, prefs: JoinPreferences) => {
    setRoomId(room);
    setUserName(name);
    setJoinPrefs(prefs);
    setInRoom(true);

    // Update URL with room param
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    window.history.pushState({}, "", url.toString());
  };

  const handleLeaveRoom = () => {
    setInRoom(false);
    setJoinPrefs(null);

    // Remove room param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.pushState({}, "", url.toString());
  };

  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="min-h-[100dvh] bg-ah-bg text-ah-text font-sans selection:bg-ah-selection-bg selection:text-ah-text transition-colors duration-300">
          {!inRoom ? (
            <PreJoinScreen
              onJoinRoom={handleJoinRoom}
              initialRoomId={initialRoomId}
            />
          ) : (
            <WebRTCProvider>
              <RoomScreen
                roomId={roomId}
                userName={userName}
                userId={userId}
                serverUrl={SERVER_URL}
                onLeave={handleLeaveRoom}
                joinPrefs={joinPrefs}
              />
            </WebRTCProvider>
          )}

          {/* Developer Signature Stamp */}
          {!inRoom && (
            <a
              href="https://github.com/chandan-builds"
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-6 right-6 z-50 hidden md:flex items-center gap-2.5 rounded-full border border-ah-border-subtle bg-ah-surface/60 px-4 py-2 text-xs font-medium backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-ah-surface-raised/80 hover:border-ah-border hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] cursor-pointer group"
            >
              <span className="text-ah-text-muted transition-colors group-hover:text-ah-text">Built by</span>
              <span className="font-bold tracking-wide bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                chandan-builds
              </span>
              <Sparkles className="w-3.5 h-3.5 text-purple-500 opacity-70 group-hover:opacity-100 group-hover:text-pink-500 transition-all duration-300" />
            </a>
          )}
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );
}
