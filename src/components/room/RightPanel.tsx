import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PeerData, ChatMessage } from "@/src/hooks/useWebRTC";
import type { PanelTab } from "@/src/hooks/webrtc/types";
import { ChatPanel } from "@/src/components/ChatPanel";
import { ParticipantsPanel } from "./ParticipantsPanel";

interface RightPanelProps {
  activeTab:     PanelTab;
  onTabChange:   (tab: PanelTab) => void;
  /* Chat */
  chatMessages:  ChatMessage[];
  onSendMessage: (msg: string) => void;
  unreadCount:   number;
  /* Participants */
  peers:          Map<string, PeerData>;
  localUserId:    string;
  localUserName:  string;
  localIsMuted:   boolean;
  localIsVideo:   boolean;
  userRole:       "host" | "participant";
  onHostAction:   (action: string, targetUserId: string) => void;
}

export function RightPanel({
  activeTab, onTabChange,
  chatMessages, onSendMessage, unreadCount,
  peers, localUserId, localUserName, localIsMuted, localIsVideo,
  userRole, onHostAction,
}: RightPanelProps) {
  const isOpen = activeTab !== null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="right-panel"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className={cn(
            "flex flex-col w-[320px] shrink-0",
            "border-l border-zinc-200 dark:border-zinc-800/60",
            "bg-white/90 dark:bg-zinc-950/80 backdrop-blur-xl",
            "h-full overflow-hidden",
          )}
        >
          {/* Tab bar */}
          <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800/60 shrink-0">
            <button
              id="right-panel-chat-tab"
              onClick={() => onTabChange("chat")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative",
                activeTab === "chat"
                  ? "border-violet-500 text-violet-600 dark:text-violet-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Chat
              {unreadCount > 0 && activeTab !== "chat" && (
                <Badge className="ml-1 bg-violet-500 text-white border-0 text-[10px] h-4 min-w-[1rem] px-1 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </button>

            <button
              id="right-panel-participants-tab"
              onClick={() => onTabChange("participants")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "participants"
                  ? "border-violet-500 text-violet-600 dark:text-violet-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              <Users className="h-4 w-4" />
              People
            </button>

            <div className="flex-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onTabChange(null)}
                  id="right-panel-close"
                  className="mr-2 h-8 w-8 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-zinc-900 border-zinc-700 text-zinc-200 text-[11px]">
                Close panel (Esc)
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "chat" && (
              <ChatPanel
                messages={chatMessages}
                onSendMessage={onSendMessage}
                isOpen={true}
                onToggle={() => onTabChange(null)}
                embedded
              />
            )}
            {activeTab === "participants" && (
              <ParticipantsPanel
                peers={peers}
                localUserId={localUserId}
                localUserName={localUserName}
                localIsMuted={localIsMuted}
                localIsVideo={localIsVideo}
                userRole={userRole}
                onHostAction={onHostAction}
              />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
