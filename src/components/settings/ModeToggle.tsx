import type { AppMode } from "@/core/types";
import { cn } from "@/utils/cn";

type ModeToggleProps = {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
};

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
      {(["normal", "technician"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold capitalize tracking-wide transition",
            mode === value
              ? "bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(56,213,255,.25)]"
              : "text-slate-300 hover:text-white"
          )}
          aria-pressed={mode === value}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
