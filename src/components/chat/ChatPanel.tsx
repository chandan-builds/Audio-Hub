import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";
import { Send, MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/src/hooks/useWebRTC";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPanel({ messages, onSendMessage, isOpen, onToggle }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (!isOpen && messages.length > 0) {
      setUnreadCount((prev) => prev + 1);
    }
  }, [messages, isOpen]);

  // Reset unread when opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Toggle button (when closed) */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={onToggle}
          className="fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full bg-[#18181b]/90 backdrop-blur-xl border border-zinc-700/80 shadow-2xl shadow-violet-900/20 flex items-center justify-center hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95 xl:bottom-8"
        >
          <MessageSquare className="h-6 w-6 text-violet-400" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-6 w-6 bg-violet-500 rounded-full text-[11px] font-bold flex items-center justify-center text-white ring-2 ring-[#09090b]">
              {unreadCount}
            </span>
          )}
        </motion.button>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-4 top-20 bottom-24 xl:top-20 xl:bottom-4 xl:right-4 w-80 z-40 bg-[#18181b]/80 backdrop-blur-3xl border border-zinc-800/60 rounded-3xl flex flex-col shadow-2xl shadow-black/80 ring-1 ring-white/5"
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-800/40 flex items-center justify-between bg-zinc-900/20 rounded-t-3xl">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-violet-400" />
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-100">
                  Chat
                </span>
              </div>
              <button
                onClick={onToggle}
                className="p-1.5 hover:bg-zinc-800/80 rounded-full transition-colors group"
              >
                <X className="h-4 w-4 text-zinc-400 group-hover:text-zinc-200" />
              </button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-10 opacity-60">
                    <div className="h-12 w-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="h-6 w-6 text-zinc-400" />
                    </div>
                    <p className="text-sm font-medium text-zinc-300">No messages yet</p>
                    <p className="text-xs text-zinc-500 mt-1">Start the conversation! 👋</p>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isConsecutive = i > 0 && messages[i - 1].userId === msg.userId && /^\d+$/.test(messages[i - 1].userId); // Just an approximation for consecutive logic
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn(
                        "flex gap-3",
                        msg.isLocal && "flex-row-reverse",
                        isConsecutive ? "mt-1" : "mt-4"
                      )}
                    >
                      {!isConsecutive ? (
                        <Avatar className={cn("h-8 w-8 flex-shrink-0 border", msg.isLocal ? "border-violet-500/30" : "border-zinc-700/50")}>
                          <AvatarFallback className="bg-[#09090b] text-[10px] text-zinc-300 font-bold">
                            {msg.userName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )}
                      <div className={cn("max-w-[70%]", msg.isLocal && "text-right")}>
                        {!isConsecutive && (
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-[11px] font-semibold text-zinc-300">
                              {msg.isLocal ? "You" : msg.userName}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-mono tracking-wider">
                              {formatTime(msg.timestamp)}
                            </span>
                          </div>
                        )}
                        <div
                          className={cn(
                            "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                            msg.isLocal
                              ? "bg-violet-600 text-white rounded-tr-sm shadow-sm shadow-violet-900/20"
                              : "bg-[#27272a]/60 backdrop-blur-md border border-zinc-700/30 text-zinc-100 rounded-tl-sm shadow-sm shadow-black/10"
                          )}
                        >
                          {msg.message}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-zinc-800/40 bg-zinc-900/20 rounded-b-3xl">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="bg-zinc-950/50 border-zinc-800/60 focus:border-violet-500/50 focus:ring-violet-500/20 text-zinc-100 placeholder:text-zinc-500 h-12 text-sm rounded-2xl"
                />
                <Button
                  onClick={handleSend}
                  size="icon"
                  disabled={!input.trim()}
                  className="h-12 w-12 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl flex-shrink-0 disabled:opacity-30 transition-all shadow-md shadow-violet-900/20"
                >
                  <Send className="h-5 w-5 ml-0.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
