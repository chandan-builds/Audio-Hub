import { MessageSquare, LogIn, LogOut, MicOff, Mic, Monitor, MonitorOff, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ActivityEvent } from "@/src/hooks/useWebRTC";

interface ActivityPanelProps {
  activityLog: ActivityEvent[];
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

export function ActivityPanel({ activityLog }: ActivityPanelProps) {
  return (
    <div className="flex flex-col h-full bg-ah-surface/30">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {activityLog.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Activity className="h-8 w-8 mb-3 text-ah-text-muted/30" />
              <p className="font-mono text-sm text-ah-text-muted">No activity yet</p>
            </div>
          )}
          {activityLog.map((event, i) => (
            <div key={i} className="flex gap-3 items-start group">
              <div className={`mt-1.5 h-2 w-2 rounded-full ${getEventDot(event.type)} ring-2 ring-ah-bg`} />
              <div className="flex-1 min-w-0 bg-ah-surface-raised/50 p-2.5 rounded-lg border border-ah-border-subtle group-hover:bg-ah-surface-raised transition-colors">
                <div className="flex items-center gap-1.5">
                  {getEventIcon(event.type)}
                  <p className="truncate text-sm font-medium text-ah-text">
                    {getEventText(event)}
                  </p>
                </div>
                <p className="mt-1 font-mono text-[10px] text-ah-text-faint uppercase font-semibold">
                  {formatTimeAgo(event.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
