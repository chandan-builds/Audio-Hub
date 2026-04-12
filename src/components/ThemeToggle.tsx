import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, isCompact = false }: { className?: string, isCompact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const pillSize = isCompact ? 20 : 24;
  const slideDistance = isCompact ? 20 : 24;

  return (
    <button
      onClick={toggleTheme}
      style={{ backgroundColor: "var(--ah-toggle-track)" }}
      className={cn(
        "relative flex items-center rounded-full p-1 transition-colors duration-300 flex-shrink-0",
        isCompact ? "w-12 h-7" : "w-14 h-8",
        className
      )}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {/* Track icons */}
      <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
        <Sun className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4", "text-amber-500", isDark && "opacity-50 grayscale")} />
        <Moon className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4", isDark ? "text-violet-400" : "text-ah-text-muted")} />
      </div>
      
      {/* Sliding pill */}
      <motion.div
        style={{ backgroundColor: "var(--ah-toggle-thumb)", width: pillSize, height: pillSize }}
        className={cn(
          "relative z-10 rounded-full shadow-sm flex items-center justify-center",
          !isDark && "border border-ah-border"
        )}
        initial={false}
        animate={{
          x: isDark ? slideDistance : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
      >
        {isDark ? (
          <Moon className={cn(isCompact ? "h-2 w-2" : "h-3 w-3", "text-ah-text-muted")} />
        ) : (
          <Sun className={cn(isCompact ? "h-2 w-2" : "h-3 w-3", "text-amber-500")} />
        )}
      </motion.div>
    </button>
  );
}
