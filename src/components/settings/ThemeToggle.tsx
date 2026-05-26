import type { ThemeMode } from "@/core/types";
import { cn } from "@/utils/cn";

type ThemeToggleProps = {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
};

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      Theme
      <select
        value={theme}
        onChange={(event) => onChange(event.target.value as ThemeMode)}
        className={cn(
          "rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none",
          "focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
        )}
      >
        <option value="system">System</option>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </label>
  );
}
