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
    <aside className="w-80 border-l border-zinc-200 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/40 backdrop-blur-sm hidden xl:flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-zinc-500" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-600 dark:text-zinc-400">
            Activity
          </span>
        </div>
        <Badge className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/50 text-[10px] font-mono">
          {roomUserCount} {roomUserCount === 1 ? "USER" : "USERS"}
        </Badge>
      </div>

      {/* Activity feed */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {activityLog.length === 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-600 text-center py-4 font-mono">No activity yet</p>
          )}
          {activityLog.map((event, i) => (
            <div key={i} className="flex gap-3 items-start group">
              <div className={`h-2 w-2 rounded-full mt-1.5 ${getEventDot(event.type)} ring-2 ring-white dark:ring-zinc-900`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {getEventIcon(event.type)}
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium truncate">
                    {getEventText(event)}
                  </p>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono mt-0.5">
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
