/**
 * ShortcutHelpModal — keyboard-shortcut overlay.
 * Phase 6 — full glassmorphism design-token pass.
 */
import { motion, AnimatePresence } from "motion/react";
import { X, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface Shortcut {
  key: string;
  label: string;
  category?: string;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  /* Media */
  { key: "M",     label: "Toggle mute",          category: "Media"    },
  { key: "V",     label: "Toggle camera",         category: "Media"    },
  { key: "S",     label: "Toggle screen share",   category: "Media"    },
  { key: "Space", label: "Push to talk (hold)",   category: "Media"    },
  /* UI */
  { key: "C",     label: "Open / close chat",     category: "Interface" },
  { key: "P",     label: "Open participants",      category: "Interface" },
  { key: ",",     label: "Open settings",          category: "Interface" },
  { key: "?",     label: "This shortcut menu",     category: "Interface" },
  /* Room */
  { key: "L",     label: "Leave room",             category: "Room"     },
  { key: "R",     label: "Toggle recording",       category: "Room"     },
];

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts?: Shortcut[];
}

export function ShortcutHelpModal({
  isOpen,
  onClose,
  shortcuts = DEFAULT_SHORTCUTS,
}: ShortcutHelpModalProps) {
  /* Group by category */
  const groups = shortcuts.reduce<Record<string, Shortcut[]>>((acc, s) => {
    const cat = s.category ?? "General";
    (acc[cat] ??= []).push(s);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="shortcut-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-lg"
          />

          {/* Panel */}
          <motion.div
            key="shortcut-modal"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4"
          >
            <div className="bg-ah-surface/90 backdrop-blur-3xl border border-ah-glass-border rounded-3xl shadow-2xl shadow-black/50 overflow-hidden">

              {/* Header */}
              <div className="px-6 py-5 border-b border-ah-glass-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-violet-500/15 border border-violet-400/20 flex items-center justify-center">
                    <Keyboard className="h-4 w-4 text-violet-400" />
                  </div>
                  <h2 className="text-base font-bold text-ah-text">Keyboard Shortcuts</h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close shortcuts"
                  className="h-8 w-8 flex items-center justify-center rounded-xl text-ah-text-muted hover:text-ah-text hover:bg-ah-glass border border-transparent hover:border-ah-glass-border transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Shortcut list */}
              <div className="p-6 space-y-6 max-h-[58vh] overflow-y-auto scrollbar-thin">
                {Object.entries(groups).map(([cat, items]) => (
                  <div key={cat} className="space-y-2">
                    {/* Category label */}
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-ah-text-subtle">
                      {cat}
                    </p>

                    {/* Rows */}
                    <div className="space-y-1.5">
                      {items.map(s => (
                        <div
                          key={s.key}
                          className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-ah-glass border border-ah-glass-border group hover:bg-ah-surface-raised transition-colors"
                        >
                          <span className="text-[13px] text-ah-text">{s.label}</span>
                          <KeyBadge combo={s.key} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <p className="text-[11px] text-ah-text-subtle text-center leading-relaxed px-2">
                  Shortcuts are disabled while typing in chat or settings.
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-ah-glass-border">
                <button
                  onClick={onClose}
                  className={cn(
                    "w-full h-11 rounded-2xl text-sm font-bold text-white transition-all",
                    "bg-gradient-to-r from-violet-600 to-violet-500",
                    "hover:from-violet-500 hover:to-violet-400",
                    "shadow-md shadow-violet-500/25 hover:shadow-violet-500/40"
                  )}
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── KeyBadge ─────────────────────────────────────────────────────────────── */
function KeyBadge({ combo }: { combo: string }) {
  const parts = combo.split("+").map(p => p.trim());
  return (
    <span className="flex items-center gap-1">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <kbd className="px-2.5 py-1 rounded-lg bg-ah-surface-raised border border-ah-border text-[11px] font-mono font-bold text-ah-text-muted min-w-[28px] text-center">
            {p.length === 1 ? p.toUpperCase() : p}
          </kbd>
          {i < parts.length - 1 && (
            <span className="text-[9px] text-ah-text-subtle">+</span>
          )}
        </span>
      ))}
    </span>
  );
}
