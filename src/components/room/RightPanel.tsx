import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageSquare, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PeerData, ChatMessage, ActivityEvent } from "@/src/hooks/useWebRTC";
import type { PanelTab } from "@/src/hooks/webrtc/types";
import { ChatPanel } from "@/src/components/ChatPanel";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { ActivityPanel } from "./ActivityPanel";

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
  /* Activity */
  activityLog:    ActivityEvent[];
}

export function RightPanel({
  activeTab, onTabChange,
  chatMessages, onSendMessage, unreadCount,
  peers, localUserId, localUserName, localIsMuted, localIsVideo,
  userRole, onHostAction,
  activityLog,
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
            "border-l border-ah-border",
            "bg-ah-surface/95 backdrop-blur-xl",
            "h-full overflow-hidden",
          )}
        >
          {/* Tab bar */}
          <div className="flex items-center border-b border-ah-border shrink-0">
            <button
              id="right-panel-chat-tab"
              onClick={() => onTabChange("chat")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative",
                activeTab === "chat"
                  ? "border-[color:var(--ah-accent)] text-ah-accent"
                  : "border-transparent text-ah-text-muted hover:text-ah-text"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Chat
              {unreadCount > 0 && activeTab !== "chat" && (
                <Badge className="ml-1 bg-[color:var(--ah-accent)] text-white border-0 text-[10px] h-4 min-w-[1rem] px-1 flex items-center justify-center">
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
                  ? "border-[color:var(--ah-accent)] text-ah-accent"
                  : "border-transparent text-ah-text-muted hover:text-ah-text"
              )}
            >
              <Users className="h-4 w-4" />
              People
            </button>

            <button
              id="right-panel-activity-tab"
              onClick={() => onTabChange("activity")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "activity"
                  ? "border-[color:var(--ah-accent)] text-ah-accent"
                  : "border-transparent text-ah-text-muted hover:text-ah-text"
              )}
            >
              <Activity className="h-4 w-4" />
              Activity
            </button>

            <div className="flex-1" />

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onTabChange(null)}
                    id="right-panel-close"
                    className="mr-2 h-8 w-8 text-ah-text-muted hover:text-ah-text"
                  />
                }
              >
                <X className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-ah-surface border-ah-border text-ah-text text-[11px]">
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
            {activeTab === "activity" && (
              <ActivityPanel activityLog={activityLog} />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
