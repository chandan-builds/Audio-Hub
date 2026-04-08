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
      className={cn(
        "relative flex items-center rounded-full p-1 transition-colors duration-300 flex-shrink-0",
        isDark ? "bg-zinc-800" : "bg-zinc-200 border border-zinc-300/50",
        isCompact ? "w-12 h-7" : "w-14 h-8",
        className
      )}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {/* Track icons */}
      <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
        <Sun className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4", "text-amber-500", isDark && "opacity-50 grayscale")} />
        <Moon className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4", isDark ? "text-violet-400" : "text-zinc-500")} />
      </div>
      
      {/* Sliding pill */}
      <motion.div
        className={cn(
          "relative z-10 rounded-full shadow-sm flex items-center justify-center",
          isDark ? "bg-zinc-950 shadow-black/50" : "bg-white shadow-black/10 border border-zinc-200"
        )}
        style={{ width: pillSize, height: pillSize }}
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
          <Moon className={cn(isCompact ? "h-2 w-2" : "h-3 w-3", "text-zinc-300")} />
        ) : (
          <Sun className={cn(isCompact ? "h-2 w-2" : "h-3 w-3", "text-amber-500")} />
        )}
      </motion.div>
    </button>
  );
}
