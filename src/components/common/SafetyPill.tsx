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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize tracking-wide",
        safetyTone[safety],
        className
      )}
    >
      {safety}
    </span>
  );
}
