import React, { useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebRTCMemory } from "@/src/hooks/webrtc/memory/useWebRTCMemory";
import type { Toast, ToastType } from "@/src/hooks/webrtc/types";

// ── Icon map ──────────────────────────────────────────────────────────────────
const TOAST_ICONS: Record<ToastType, React.FC<{ className?: string }>> = {
  success: CheckCircle2,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
};

// ── Color map (Glassmorphic / dark-first) ─────────────────────────────────────
const TOAST_STYLES: Record<ToastType, { border: string; icon: string; bar: string }> = {
  success: {
    border: "border-emerald-500/30 shadow-emerald-900/20",
    icon:   "text-emerald-400",
    bar:    "bg-emerald-500",
  },
  error: {
    border: "border-red-500/30 shadow-red-900/20",
    icon:   "text-red-400",
    bar:    "bg-red-500",
  },
  warning: {
    border: "border-amber-500/30 shadow-amber-900/20",
    icon:   "text-amber-400",
    bar:    "bg-amber-500",
  },
  info: {
    border: "border-violet-500/30 shadow-violet-900/20",
    icon:   "text-violet-400",
    bar:    "bg-violet-500",
  },
};

// ── Single Toast Item ─────────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = TOAST_ICONS[toast.type];
  const styles = TOAST_STYLES[toast.type];

  return (
    <motion.div
      key={toast.id}
      layout
      initial={{ opacity: 0, x: 60, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      role="alert"
      aria-live="polite"
      className={cn(
        "relative overflow-hidden w-full max-w-xs rounded-2xl border",
        "bg-zinc-900/90 dark:bg-zinc-950/95 backdrop-blur-xl",
        "shadow-xl shadow-black/30",
        styles.border
      )}
    >
      {/* Content row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Icon className={cn("h-4 w-4 flex-shrink-0", styles.icon)} />
        <p className="flex-1 text-sm font-medium text-zinc-100 dark:text-zinc-100 leading-snug">
          {toast.message}
        </p>
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="flex-shrink-0 p-1 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors duration-150"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <motion.div
        className={cn("absolute bottom-0 left-0 h-[2px]", styles.bar)}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: toast.duration / 1000, ease: "linear" }}
      />
    </motion.div>
  );
}

// ── Toast Container (portal-style, fixed position) ────────────────────────────
export function ToastContainer() {
  const { toasts, removeToast } = useWebRTCMemory();

  const handleDismiss = useCallback((id: string) => {
    removeToast(id);
  }, [removeToast]);

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-24 right-4 z-[200] flex flex-col gap-2 w-[320px] pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={handleDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Standalone hook for easy external use ─────────────────────────────────────
export function useToast() {
  const { addToast, removeToast } = useWebRTCMemory();
  return { addToast, removeToast };
}
