// src/components/activity/ActivitySidebar.tsx
import { MessageSquare, LogIn, LogOut, MicOff, Mic, Monitor, MonitorOff } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ActivityEvent } from "@/src/hooks/useWebRTC";

interface ActivitySidebarProps {
  activityLog: ActivityEvent[];
  roomUserCount: number;
}

function getEventIcon(type: ActivityEvent["type"]) {
  switch (type) {
    case "join":
      return <LogIn className="h-3 w-3 text-emerald-400" />;
    case "leave":
      return <LogOut className="h-3 w-3 text-red-400" />;
    case "mute":
      return <MicOff className="h-3 w-3 text-amber-400" />;
    case "unmute":
      return <Mic className="h-3 w-3 text-emerald-400" />;
    case "screen-share":
      return <Monitor className="h-3 w-3 text-cyan-400" />;
    case "screen-stop":
      return <MonitorOff className="h-3 w-3 text-zinc-500" />;
    case "chat":
      return <MessageSquare className="h-3 w-3 text-violet-400" />;
  }
}

function getEventDot(type: ActivityEvent["type"]) {
  switch (type) {
    case "join":
    case "unmute":
      return "bg-emerald-400";
    case "leave":
      return "bg-red-400";
    case "mute":
      return "bg-amber-400";
    case "screen-share":
      return "bg-cyan-400";
    case "screen-stop":
      return "bg-zinc-500";
    case "chat":
      return "bg-violet-400";
  }
}

function getEventText(event: ActivityEvent) {
  switch (event.type) {
    case "join":
      return `${event.userName} joined`;
    case "leave":
      return `${event.userName} left`;
    case "mute":
      return `${event.userName} muted`;
    case "unmute":
      return `${event.userName} unmuted`;
    case "screen-share":
      return `${event.userName} started sharing`;
    case "screen-stop":
      return `${event.userName} stopped sharing`;
    case "chat":
      return `${event.userName} sent a message`;
  }
}

function formatTimeAgo(timestamp: number) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5) return "JUST NOW";
  if (diff < 60) return `${diff}S AGO`;
  if (diff < 3600) return `${Math.floor(diff / 60)}M AGO`;
  return `${Math.floor(diff / 3600)}H AGO`;
}

export function ActivitySidebar({
  activityLog,
  roomUserCount,
}: ActivitySidebarProps) {
  return (
    <aside className="w-80 border-l border-zinc-800/60 bg-[#09090b]/40 backdrop-blur-3xl hidden xl:flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/40 flex items-center justify-between bg-[#18181b]/60 z-10">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-300">
            Activity
          </span>
        </div>
        <Badge className="bg-zinc-800/60 text-zinc-300 border-zinc-700/50 text-[10px] font-mono">
          {roomUserCount} {roomUserCount === 1 ? "USER" : "USERS"}
        </Badge>
      </div>

      {/* Activity feed */}
      <ScrollArea className="flex-1 p-4 relative z-10">
        <div className="space-y-4">
          {activityLog.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-4 font-mono">No activity yet</p>
          )}
          {activityLog.map((event, i) => (
            <div key={i} className="flex gap-4 items-start group relative">
              {/* Timeline connecting line */}
              {i !== activityLog.length - 1 && (
                <div className="absolute left-1 top-4 w-0.5 h-full bg-zinc-800/40 group-hover:bg-zinc-700/60 transition-colors" />
              )}
              
              <div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${getEventDot(event.type)} shadow-md ring-4 ring-[#09090b] relative z-10`} />
              <div className="flex-1 min-w-0 bg-[#18181b]/40 rounded-xl p-3 border border-zinc-800/30 group-hover:bg-[#18181b]/80 group-hover:border-zinc-700/50 transition-all">
                <div className="flex items-center gap-1.5">
                  {getEventIcon(event.type)}
                  <p className="text-sm text-zinc-200 font-medium truncate">
                    {getEventText(event)}
                  </p>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-wider">
                  {formatTimeAgo(event.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
