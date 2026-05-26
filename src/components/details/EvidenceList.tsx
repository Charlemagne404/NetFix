import type { EvidenceItem } from "@/core/types";
import { StatusPill } from "@/components/common/StatusPill";

type EvidenceListProps = {
  evidence: EvidenceItem[];
};

export function EvidenceList({ evidence }: EvidenceListProps) {
  return (
    <div className="grid gap-3">
      {evidence.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-sm text-slate-300">{item.value}</p>
            </div>
            <StatusPill status={item.status} />
          </div>
          {item.detail ? (
            <p className="mt-3 text-sm leading-6 text-slate-400">{item.detail}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
