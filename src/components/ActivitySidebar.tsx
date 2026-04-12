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
    <aside className="hidden w-80 flex-col border-l border-ah-border bg-ah-header-bg backdrop-blur-xl xl:flex">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ah-border p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-ah-text-muted" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-ah-text-muted">
            Activity
          </span>
        </div>
        <Badge className="border-ah-border bg-ah-surface text-[10px] font-mono text-ah-text-muted">
          {roomUserCount} {roomUserCount === 1 ? "USER" : "USERS"}
        </Badge>
      </div>

      {/* Activity feed */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {activityLog.length === 0 && (
            <p className="py-4 text-center font-mono text-xs text-ah-text-faint">No activity yet</p>
          )}
          {activityLog.map((event, i) => (
            <div key={i} className="flex gap-3 items-start group">
              <div className={`mt-1.5 h-2 w-2 rounded-full ${getEventDot(event.type)} ring-2 ring-ah-bg`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {getEventIcon(event.type)}
                  <p className="truncate text-sm font-medium text-ah-text">
                    {getEventText(event)}
                  </p>
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-ah-text-faint">
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
