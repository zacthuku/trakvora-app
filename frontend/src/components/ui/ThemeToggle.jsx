import { Sun, Moon } from "lucide-react";
import { useUIStore } from "@/store/uiStore";

export default function ThemeToggle({ variant = "light" }) {
  const { theme, toggleTheme } = useUIStore();
  const isDark = theme === "dark";

  const btnCls = variant === "dark"
    ? "p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
    : "p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors";

  return (
    <button
      onClick={toggleTheme}
      className={btnCls}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
