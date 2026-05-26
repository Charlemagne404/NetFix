import type { FixSafety } from "@/core/types";
import { cn } from "@/utils/cn";
import { safetyTone } from "@/utils/status";

type SafetyPillProps = {
  safety: FixSafety;
  className?: string;
};

export function SafetyPill({ safety, className }: SafetyPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize tracking-[0.01em]",
        safetyTone[safety],
        className
      )}
    >
      {safety}
    </span>
  );
}
