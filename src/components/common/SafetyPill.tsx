import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { FixSafety } from "@/core/types";
import { cn } from "@/utils/cn";
import { safetyTone } from "@/utils/status";

type SafetyPillProps = {
  safety: FixSafety;
  className?: string;
};

export function SafetyPill({ safety, className }: SafetyPillProps) {
  const Icon =
    safety === "safe" ? ShieldCheck : safety === "moderate" ? ShieldAlert : ShieldX;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize tracking-[0.01em]",
        safetyTone[safety],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {safety}
    </span>
  );
}
