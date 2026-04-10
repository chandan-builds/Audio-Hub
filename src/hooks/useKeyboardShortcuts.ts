import { useEffect, useRef, useCallback, useState } from "react";

export interface ShortcutDefinition {
  key: string;
  /** Match modifier keys */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Human-readable label for the shortcut hint UI */
  label: string;
  action: () => void;
  /** If true, fires on keydown instead of keyup (e.g. push-to-talk hold) */
  onKeyDown?: boolean;
  onKeyUp?: () => void;
}

/** Tags that should swallow keyboard shortcuts when focused */
const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Registers global keyboard shortcuts.
 * - Safe: ignores shortcuts while an input/textarea is focused.
 * - Stable Ref pattern: action callbacks are wrapped in refs so handlers
 *   never go stale and the effect never needs to re-run.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]) {
  // Keep a stable ref to the shortcut list so the effect doesn't re-run
  // when the actions close over changing state.
  const shortcutsRef = useRef<ShortcutDefinition[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement;
      if (INPUT_TAGS.has(target.tagName) || target.isContentEditable) return;

      for (const shortcut of shortcutsRef.current) {
        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!shortcut.ctrl === e.ctrlKey &&
          !!shortcut.shift === e.shiftKey &&
          !!shortcut.alt === e.altKey
        ) {
          e.preventDefault();
          if (shortcut.onKeyDown) {
            shortcut.action();
          } else if (!shortcut.onKeyDown && !shortcut.onKeyUp) {
            // Regular keyup-style on keydown for simplicity (no hold needed)
            shortcut.action();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (INPUT_TAGS.has(target.tagName) || target.isContentEditable) return;

      for (const shortcut of shortcutsRef.current) {
        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          shortcut.onKeyUp
        ) {
          e.preventDefault();
          shortcut.onKeyUp();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []); // Empty deps: effect runs once, shortcutsRef always has latest
}

/**
 * Push-to-talk hook: calls onPress on Space keydown, onRelease on keyup.
 * Only active when enabled=true (i.e. user is muted).
 */
export function usePushToTalk(
  onPress: () => void,
  onRelease: () => void,
  enabled: boolean
) {
  const pressedRef = useRef(false);
  const onPressRef = useRef(onPress);
  const onReleaseRef = useRef(onRelease);
  onPressRef.current = onPress;
  onReleaseRef.current = onRelease;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || pressedRef.current) return;
      const target = e.target as HTMLElement;
      if (INPUT_TAGS.has(target.tagName) || target.isContentEditable) return;
      e.preventDefault();
      pressedRef.current = true;
      onPressRef.current();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !pressedRef.current) return;
      e.preventDefault();
      pressedRef.current = false;
      onReleaseRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      pressedRef.current = false;
    };
  }, [enabled]);
}

/**
 * Returns a formatted shortcut hint string for tooltips.
 * e.g. shortcutHint("m") → "M"
 * e.g. shortcutHint("m", { ctrl: true }) → "Ctrl+M"
 */
export function shortcutHint(
  key: string,
  modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean }
): string {
  const parts: string[] = [];
  if (modifiers?.ctrl) parts.push("Ctrl");
  if (modifiers?.shift) parts.push("Shift");
  if (modifiers?.alt) parts.push("Alt");
  parts.push(key.toUpperCase());
  return parts.join("+");
}

/** Convenience: build a tooltip label with shortcut hint appended */
export function withShortcut(label: string, hint: string) {
  return `${label} (${hint})`;
}

/** Map shape for passing shortcut definitions around */
export type ShortcutMap = ShortcutDefinition[];

/**
 * `useShortcutHelpModal`
 *
 * Returns state and toggle for the keyboard shortcut cheat-sheet modal.
 * "?" key opens/closes it globally. Escape closes it.
 */
export function useShortcutHelpModal() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = INPUT_TAGS.has(target.tagName) || target.isContentEditable;
      if (isTyping) return;

      if (e.key === "?") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggle, close]);

  return { isOpen, toggle, close };
}
