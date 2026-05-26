import type { AppMode } from "@/core/types";
import { cn } from "@/utils/cn";

type ModeToggleProps = {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
};

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-[12px] border border-white/10 bg-white/[0.02] p-1">
      {(["normal", "technician"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "rounded-[10px] px-3 py-2 text-[12px] font-semibold capitalize tracking-[0.01em] transition",
            mode === value
              ? "bg-[#f2f6fc] text-slate-950 shadow-[0_1px_0_rgba(255,255,255,0.2)]"
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
