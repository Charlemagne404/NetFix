import type { DiagnosticNode } from "@/core/types";

type TechnicianDetailsProps = {
  node: DiagnosticNode;
};

export function TechnicianDetails({ node }: TechnicianDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Technical label
          </p>
          <p className="mt-2 text-sm text-slate-100">{node.technicalLabel ?? node.label}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Severity
          </p>
          <p className="mt-2 text-sm capitalize text-slate-100">{node.severity}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Raw command output
        </p>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-4 font-mono text-xs leading-5 text-cyan-50/80">
          {node.rawOutput || "No raw output captured for this node."}
        </pre>
      </div>
    </div>
  );
}
