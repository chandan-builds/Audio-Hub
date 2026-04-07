import { useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Radio, Globe, Shield, ChevronRight, Copy, Check, Sparkles, Zap, Headphones
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface LobbyScreenProps {
  onJoinRoom: (roomId: string, userName: string) => void;
}

function generateRoomId(): string {
  const adjectives = ["cosmic", "stellar", "neon", "quantum", "hyper", "sonic", "turbo", "cyber", "astro", "mega"];
  const nouns = ["hub", "zone", "nexus", "space", "realm", "arena", "lounge", "den", "core", "deck"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999);
  return `${adj}-${noun}-${num}`;
}

export function LobbyScreen({ onJoinRoom }: LobbyScreenProps) {
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleJoin = () => {
    if (!roomId.trim() || !userName.trim()) {
      setError("Please enter both a display name and room ID.");
      return;
    }
    setError(null);
    onJoinRoom(roomId.trim(), userName.trim());
  };

  const handleGenerateRoom = () => {
    const id = generateRoomId();
    setRoomId(id);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleJoin();
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen p-4 overflow-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-violet-950/20 to-transparent rounded-full blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-cyan-950/15 to-transparent rounded-full blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, 15, 0], y: [0, 15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] left-[50%] w-[30%] h-[30%] bg-gradient-to-r from-fuchsia-950/10 to-transparent rounded-full blur-[120px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="bg-zinc-950/60 border-zinc-800/60 backdrop-blur-2xl shadow-2xl shadow-black/40">
          <CardHeader className="text-center space-y-3 pb-2">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex justify-center mb-1"
            >
              <div className="relative">
                <div className="p-4 bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 rounded-2xl border border-zinc-700/50 shadow-lg shadow-black/20">
                  <Radio className="h-8 w-8 text-zinc-100" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-2xl border border-zinc-500/20"
                />
              </div>
            </motion.div>
            <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Audio Hub
            </CardTitle>
            <CardDescription className="text-zinc-500 text-sm leading-relaxed">
              Crystal-clear voice chat with screen sharing.
              <br />
              Join a room and connect with anyone, instantly.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 ml-1">
                Display Name
              </label>
              <Input
                placeholder="What should we call you?"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-zinc-900/60 border-zinc-800/80 focus:border-zinc-600 focus:ring-zinc-700/50 h-12 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 ml-1">
                  Room ID
                </label>
                <button
                  onClick={handleGenerateRoom}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 group"
                >
                  <Sparkles className="h-3 w-3 group-hover:text-amber-400 transition-colors" />
                  Generate Random
                </button>
              </div>
              <div className="relative">
                <Input
                  placeholder="e.g. cosmic-nexus-42"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-zinc-900/60 border-zinc-800/80 focus:border-zinc-600 focus:ring-zinc-700/50 h-12 pr-20 text-zinc-100 placeholder:text-zinc-600"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  {roomId && (
                    <button
                      onClick={handleCopyLink}
                      className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors"
                      title="Copy invite link"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-zinc-500" />
                      )}
                    </button>
                  )}
                  <Globe className="h-4 w-4 text-zinc-600 mt-1.5 mr-1" />
                </div>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 bg-red-950/20 p-3 rounded-xl border border-red-900/30 flex items-center gap-2"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                {error}
              </motion.div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              onClick={handleJoin}
              className="w-full h-12 bg-gradient-to-r from-zinc-100 to-zinc-200 text-zinc-950 hover:from-white hover:to-zinc-100 font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-black/20"
            >
              Join Room
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </CardFooter>
        </Card>

        {/* Feature badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex justify-center gap-6"
        >
          {[
            { icon: Shield, label: "ENCRYPTED" },
            { icon: Zap, label: "LOW LATENCY" },
            { icon: Headphones, label: "BT OPTIMIZED" },
            { icon: Globe, label: "GLOBAL" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors cursor-default"
            >
              <Icon className="h-3 w-3" />
              {label}
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
