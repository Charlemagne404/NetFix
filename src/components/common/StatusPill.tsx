import type { DiagnosticStatus } from "@/core/types";
import { cn } from "@/utils/cn";
import { statusLabels, statusTone } from "@/utils/status";

type StatusPillProps = {
  status: DiagnosticStatus;
  className?: string;
};

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide",
        statusTone[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
