import { useState, useRef, useEffect, type RefObject } from "react";
import type { KeyboardEvent } from "react";
import { Send, MessageSquare, Pin, PinOff, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/src/hooks/useWebRTC";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function useLocalStorage<T>(key: string, initialValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(() => {
    try { const i = localStorage.getItem(key); return i ? JSON.parse(i) : initialValue; }
    catch { return initialValue; }
  });
  const set = (v: T | ((p: T) => T)) => {
    const val = v instanceof Function ? v(stored) : v;
    setStored(val);
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* noop */ }
  };
  return [stored, set];
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Stable hue from a string — same logic as PeerCard */
function nameHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/* ─── Avatar chip ──────────────────────────────────────────────────────────── */
function MsgAvatar({ name, isLocal }: { name: string; isLocal: boolean }) {
  const hue = isLocal ? 265 : nameHue(name);
  return (
    <div
      className="h-7 w-7 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-bold text-white shadow-sm"
      style={{ background: `oklch(0.45 0.18 ${hue})` }}
    >
      {name.substring(0, 2).toUpperCase()}
    </div>
  );
}

/* ─── Single message ───────────────────────────────────────────────────────── */
function Bubble({
  msg, isPinned, onTogglePin,
}: { msg: ChatMessage; isPinned: boolean; onTogglePin: (id: string) => void }) {
  const isLocal = msg.isLocal;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      className={cn("flex gap-2 group relative", isLocal && "flex-row-reverse")}
    >
      <MsgAvatar name={msg.userName} isLocal={isLocal} />

      <div className={cn("max-w-[72%]", isLocal && "items-end flex flex-col")}>
        {/* Name + time */}
        <div className={cn("flex items-baseline gap-1.5 mb-1 px-1", isLocal && "flex-row-reverse")}>
          <span className="text-[11px] font-semibold text-ah-text-muted truncate max-w-[120px]">
            {isLocal ? "You" : msg.userName}
          </span>
          <span className="text-[9px] text-ah-text-subtle font-mono tabular-nums">
            {formatTime(msg.timestamp)}
          </span>
        </div>

        {/* Bubble */}
        <div className="relative">
          <div
            className={cn(
              "px-3 py-2 rounded-2xl text-[13px] leading-relaxed break-words",
              isLocal
                ? "bg-violet-500/20 border border-violet-400/25 text-violet-100 rounded-tr-sm"
                : "bg-ah-glass border border-ah-glass-border text-ah-text rounded-tl-sm backdrop-blur-sm"
            )}
          >
            {msg.message}
          </div>

          {/* Pin button (hover) */}
          <button
            onClick={() => onTogglePin(msg.id)}
            aria-label={isPinned ? "Unpin message" : "Pin message"}
            className={cn(
              "absolute -top-2.5 opacity-0 group-hover:opacity-100 transition-all duration-150 scale-90 group-hover:scale-100",
              "bg-ah-surface-raised border border-ah-border rounded-full p-1 shadow-lg",
              "text-ah-text-muted hover:text-violet-400",
              isLocal ? "-left-2.5" : "-right-2.5"
            )}
          >
            {isPinned ? <PinOff className="h-2.5 w-2.5" /> : <Pin className="h-2.5 w-2.5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Chat content ─────────────────────────────────────────────────────────── */
function ChatContent({
  messages, onSendMessage, onClose, scrollRef, pinnedIds, onTogglePin,
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

  const pinnedMessages = messages.filter(m => pinnedIds.includes(m.id));
  const normalMessages = messages.filter(m => !pinnedIds.includes(m.id));

  const handleSend = () => {
    if (input.trim()) { onSendMessage(input.trim()); setInput(""); }
  };
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <>
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-ah-glass-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-violet-400" />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-ah-text-muted">
            Chat
          </span>
          {messages.length > 0 && (
            <span className="text-[10px] font-mono text-ah-text-subtle bg-ah-surface-raised px-1.5 py-0.5 rounded-full border border-ah-border">
              {messages.length}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="h-6 w-6 flex items-center justify-center rounded-lg text-ah-text-muted hover:text-ah-text hover:bg-ah-glass transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Pinned strip ── */}
      <AnimatePresence>
        {pinnedMessages.length > 0 && (
          <motion.div
            key="pinned"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-violet-500/20 bg-violet-500/5 px-4 py-2 space-y-1.5"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Pin className="h-2.5 w-2.5 text-violet-400 fill-violet-400" />
              <span className="text-[9px] uppercase font-bold tracking-widest text-violet-400">Pinned</span>
            </div>
            {pinnedMessages.map(msg => (
              <motion.div
                key={`pin-${msg.id}`}
                layout
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                className="flex items-start gap-2 group"
              >
                <MsgAvatar name={msg.userName} isLocal={msg.isLocal} />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-ah-text-muted truncate block">
                    {msg.isLocal ? "You" : msg.userName}
                  </span>
                  <span className="text-[12px] text-ah-text truncate block">{msg.message}</span>
                </div>
                <button
                  onClick={() => onTogglePin(msg.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-ah-text-muted hover:text-red-400 p-0.5 rounded"
                >
                  <PinOff className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages ── */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
        <div className="space-y-3">
          {normalMessages.length === 0 && pinnedMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 opacity-40">
              <MessageSquare className="h-10 w-10 text-ah-text-subtle mb-3" />
              <p className="text-xs text-ah-text-muted">No messages yet</p>
              <p className="text-[11px] text-ah-text-subtle mt-1">Say hello! 👋</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {normalMessages.map(msg => (
              <Bubble
                key={msg.id}
                msg={msg}
                isPinned={pinnedIds.includes(msg.id)}
                onTogglePin={onTogglePin}
              />
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* ── Input ── */}
      <div className="px-3 py-3 border-t border-ah-glass-border shrink-0">
        <div className="flex gap-2 items-center bg-ah-glass border border-ah-glass-border rounded-2xl px-3 py-2 backdrop-blur-sm focus-within:border-violet-500/40 transition-all">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the room…"
            className="flex-1 bg-transparent text-[13px] text-ah-text placeholder:text-ah-text-subtle outline-none"
            autoComplete="off"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            aria-label="Send message"
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-xl transition-all duration-200",
              input.trim()
                ? "bg-violet-500 text-white hover:bg-violet-600 shadow-md shadow-violet-500/30 scale-100"
                : "bg-ah-surface-raised text-ah-text-subtle scale-90 opacity-40 cursor-not-allowed"
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[9px] text-ah-text-subtle text-center mt-1.5 opacity-60">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </>
  );
}

/* ─── Public component ─────────────────────────────────────────────────────── */
interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  embedded?: boolean;
}

export function ChatPanel({ messages, onSendMessage, isOpen, onToggle, embedded = false }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pinnedIds, setPinnedIds] = useLocalStorage<string[]>("audio_hub_pinned_chats", []);

  const togglePin = (id: string) =>
    setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (!isOpen && messages.length > 0) setUnreadCount(c => c + 1);
  }, [messages, isOpen]);

  useEffect(() => { if (isOpen) setUnreadCount(0); }, [isOpen]);

  const content = (
    <ChatContent
      messages={messages}
      onSendMessage={onSendMessage}
      onClose={embedded ? undefined : onToggle}
      scrollRef={scrollRef}
      pinnedIds={pinnedIds}
      onTogglePin={togglePin}
    />
  );

  if (embedded) {
    return <div className="flex flex-col h-full">{content}</div>;
  }

  return (
    <>
      {/* FAB when closed */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={onToggle}
          className="fixed bottom-24 right-6 z-50 h-12 w-12 rounded-2xl bg-ah-glass border border-ah-glass-border shadow-xl backdrop-blur-xl flex items-center justify-center hover:bg-ah-surface-raised transition-colors xl:hidden"
        >
          <MessageSquare className="h-5 w-5 text-ah-text" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-violet-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-lg">
              {unreadCount}
            </span>
          )}
        </motion.button>
      )}

      {/* Floating slide-in panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-16 bottom-20 xl:bottom-0 w-80 z-40 flex flex-col bg-ah-surface/90 border-l border-ah-glass-border backdrop-blur-2xl shadow-2xl"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
