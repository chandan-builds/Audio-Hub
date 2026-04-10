import { useState, useRef, useEffect, type RefObject } from "react";
import type { KeyboardEvent } from "react";
import { Send, MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/src/hooks/useWebRTC";

// Custom hook for local storage
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn("Error reading localStorage", error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn("Error setting localStorage", error);
    }
  };

  return [storedValue, setValue];
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  /** When true, renders inline filling parent — no fixed overlay */
  embedded?: boolean;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─── Shared inner content (used by both embedded and floating) ────── */
function ChatContent({
  messages,
  onSendMessage,
  onClose,
  scrollRef,
  pinnedIds,
  onTogglePin,
}: {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  onClose?: () => void;
  scrollRef: RefObject<HTMLDivElement>;
  pinnedIds: string[];
  onTogglePin: (id: string) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pinnedMessages = messages.filter((m) => pinnedIds.includes(m.id));
  const normalMessages = messages.filter((m) => !pinnedIds.includes(m.id));

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
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-800 dark:text-zinc-300">
            Chat
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          >
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {/* Pinned Messages Section */}
          <AnimatePresence>
            {pinnedMessages.length > 0 && (
              <motion.div
                key="pinned-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="sticky top-0 z-10 space-y-2 mb-4 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-xl pb-3 border-b border-violet-100 dark:border-violet-900/30"
              >
                <div className="flex items-center gap-1.5 px-1 pt-1 pb-2">
                  <Pin className="h-3 w-3 text-violet-500 fill-violet-500" />
                  <span className="text-[10px] uppercase font-bold text-violet-600 dark:text-violet-400">Pinned</span>
                </div>

                {pinnedMessages.map((msg) => (
                  <motion.div
                    key={`pinned-${msg.id}`}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex gap-2 group relative border border-violet-100 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-500/5 p-2 rounded-xl"
                  >
                    <Avatar className="h-6 w-6 flex-shrink-0 border border-violet-200 dark:border-violet-800">
                      <AvatarFallback className="bg-violet-100 dark:bg-violet-900/50 text-[9px] text-violet-700 dark:text-violet-300">
                        {msg.userName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="max-w-[80%] flex-1">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                          {msg.isLocal ? "You" : msg.userName}
                        </span>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-600 font-mono">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <div className="text-[13px] text-zinc-800 dark:text-zinc-200 break-words leading-tight">
                        {msg.message}
                      </div>
                    </div>

                    <button
                      onClick={() => onTogglePin(msg.id)}
                      className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1.5 rounded-full shadow-sm text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <PinOff className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {normalMessages.length === 0 && pinnedMessages.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 text-zinc-200 dark:text-zinc-800 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 dark:text-zinc-500">No messages yet</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">Say hello! 👋</p>
            </div>
          )}

          {normalMessages.map((msg) => (
            <motion.div
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-2 group relative", msg.isLocal && "flex-row-reverse")}
            >
              <Avatar className="h-7 w-7 flex-shrink-0 border border-zinc-200 dark:border-zinc-800">
                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-400">
                  {msg.userName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className={cn("max-w-[70%] flex-1", msg.isLocal && "text-right")}>
                <div className="flex items-baseline gap-2 mb-0.5" style={{ flexDirection: msg.isLocal ? "row-reverse" : "row" }}>
                  <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    {msg.isLocal ? "You" : msg.userName}
                  </span>
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-600 font-mono">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={cn(
                    "px-3 py-2 rounded-2xl text-sm break-words relative",
                    msg.isLocal
                      ? "bg-violet-100 dark:bg-violet-600/20 text-violet-900 dark:text-violet-200 rounded-tr-sm"
                      : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-200 rounded-tl-sm"
                  )}
                >
                  {msg.message}
                  <button
                    onClick={() => onTogglePin(msg.id)}
                    className={cn(
                      "absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1.5 rounded-full shadow-sm text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400",
                      msg.isLocal ? "-left-3" : "-right-3"
                    )}
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/60 shrink-0">
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
    </>
  );
}

/* ─── Public component ─────────────────────────────────────────────── */
export function ChatPanel({ messages, onSendMessage, isOpen, onToggle, embedded = false }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pinnedIds, setPinnedIds] = useLocalStorage<string[]>("audio_hub_pinned_chats", []);

  const togglePin = (msgId: string) => {
    setPinnedIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]
    );
  };

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
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  /* Embedded mode: fills parent container directly */
  if (embedded) {
    return (
      <div className="flex flex-col h-full">
        <ChatContent
          messages={messages}
          onSendMessage={onSendMessage}
          scrollRef={scrollRef}
          pinnedIds={pinnedIds}
          onTogglePin={togglePin}
        />
      </div>
    );
  }

  /* Standalone floating mode */
  return (
    <>
      {/* Toggle button (when closed) */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={onToggle}
          className="fixed bottom-24 right-6 z-50 h-12 w-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xl shadow-black/10 dark:shadow-black/30 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors xl:hidden"
        >
          <MessageSquare className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-violet-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
              {unreadCount}
            </span>
          )}
        </motion.button>
      )}

      {/* Floating panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-16 bottom-20 xl:bottom-0 w-80 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-l border-zinc-200 dark:border-zinc-800/60 flex flex-col shadow-2xl shadow-black/5 dark:shadow-black/50"
          >
            <ChatContent
              messages={messages}
              onSendMessage={onSendMessage}
              onClose={onToggle}
              scrollRef={scrollRef}
              pinnedIds={pinnedIds}
              onTogglePin={togglePin}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
