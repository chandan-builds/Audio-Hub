import { motion, AnimatePresence } from "motion/react";
import { X, Keyboard } from "lucide-react";
import type { ShortcutDefinition } from "@/src/hooks/useKeyboardShortcuts";

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutDefinition[];
}

export function ShortcutHelpModal({ isOpen, onClose, shortcuts }: ShortcutHelpModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="shortcut-modal-backdrop"
          className="shortcut-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <motion.div
            className="shortcut-modal-card"
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shortcut-modal-header">
              <div className="shortcut-modal-title-group">
                <Keyboard size={18} />
                <h2 className="shortcut-modal-title">Keyboard Shortcuts</h2>
              </div>
              <button
                id="shortcut-modal-close"
                className="shortcut-modal-close"
                onClick={onClose}
                aria-label="Close keyboard shortcuts"
              >
                <X size={18} />
              </button>
            </div>

            {/* Shortcut grid */}
            <div className="shortcut-modal-list">
              {shortcuts.map((s) => (
                <div key={s.key} className="shortcut-row">
                  <span className="shortcut-description">
                    {/* Use label if it has descriptive text, else key */}
                    {s.label}
                  </span>
                  <kbd className="shortcut-kbd">
                    {s.key === " " ? "Space" : s.key.toUpperCase()}
                  </kbd>
                </div>
              ))}
              {/* Always show help shortcut */}
              <div className="shortcut-row">
                <span className="shortcut-description">Show / hide shortcuts</span>
                <kbd className="shortcut-kbd">?</kbd>
              </div>
            </div>

            <p className="shortcut-modal-footer">
              Shortcuts are disabled while typing in chat or input fields.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
