import type { ScanResult } from "@/core/types";
import { StatusPill } from "@/components/common/StatusPill";

type RecentScansProps = {
  scans: ScanResult[];
};

export function RecentScans({ scans }: RecentScansProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-panel backdrop-blur-2xl">
      <h2 className="text-lg font-semibold tracking-tight text-white">Recent scans</h2>
      <div className="mt-4 space-y-3">
        {scans.slice(0, 3).map((scan) => (
          <article
            key={scan.id}
            className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{scan.diagnosis.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(scan.createdAt).toLocaleString()} · {scan.mode}
                </p>
              </div>
              <StatusPill status={scan.overallStatus} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
