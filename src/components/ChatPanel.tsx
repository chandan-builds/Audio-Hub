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
          className="fixed bottom-24 right-6 z-50 h-12 w-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xl shadow-black/10 dark:shadow-black/30 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors xl:bottom-6"
        >
          <MessageSquare className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-violet-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
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
            className="fixed right-0 top-16 bottom-20 xl:bottom-0 w-80 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-l border-zinc-200 dark:border-zinc-800/60 flex flex-col shadow-2xl shadow-black/5 dark:shadow-black/50"
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-800 dark:text-zinc-300">
                  Chat
                </span>
              </div>
              <button
                onClick={onToggle}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
              >
                <X className="h-4 w-4 text-zinc-500" />
              </button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-8 w-8 text-zinc-200 dark:text-zinc-800 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">No messages yet</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">Say hello! 👋</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-2",
                      msg.isLocal && "flex-row-reverse"
                    )}
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0 border border-zinc-200 dark:border-zinc-800">
                      <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-400">
                        {msg.userName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn("max-w-[70%]", msg.isLocal && "text-right")}>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                          {msg.isLocal ? "You" : msg.userName}
                        </span>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-600 font-mono">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "px-3 py-2 rounded-2xl text-sm",
                          msg.isLocal
                            ? "bg-violet-100 dark:bg-violet-600/20 text-violet-900 dark:text-violet-200 rounded-tr-sm"
                            : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-200 rounded-tl-sm"
                        )}
                      >
                        {msg.message}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/60">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/60 text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-500 dark:placeholder:text-zinc-600 h-10 text-sm"
                />
                <Button
                  onClick={handleSend}
                  size="icon"
                  disabled={!input.trim()}
                  className="h-10 w-10 bg-violet-600 hover:bg-violet-700 dark:bg-violet-600/80 dark:hover:bg-violet-600 text-white rounded-xl flex-shrink-0 disabled:opacity-30 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
