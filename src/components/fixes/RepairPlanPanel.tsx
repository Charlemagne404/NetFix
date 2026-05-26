import { ArrowRight, RotateCcw } from "lucide-react";
import type {
  FixAction,
  FixExecutionResult,
  OverallDiagnosis
} from "@/core/types";
import { SafetyPill } from "@/components/common/SafetyPill";

type RepairPlanPanelProps = {
  diagnosis: OverallDiagnosis;
  fixResult: FixExecutionResult | null;
  isScanning: boolean;
  onOpenAdvancedOptions: () => void;
  onRunFix: (fix: FixAction) => void;
  onRunScan: () => void;
  onViewReport: () => void;
};

function actionLabel(fix: FixAction) {
  if (fix.id === "renew-dhcp") return "Renew IP";
  if (fix.id === "restart-adapter") return "Restart Adapter";
  if (fix.id === "flush-dns") return "Flush DNS";
  if (fix.id === "open-network-settings") return "View Guide";
  if (fix.safety === "safe") return "Apply Safe Fix";
  if (fix.safety === "moderate") return "Review Fix";
  return "Preview Fix";
}

export function RepairPlanPanel({
  diagnosis,
  fixResult,
  isScanning,
  onOpenAdvancedOptions,
  onRunFix,
  onRunScan,
  onViewReport
}: RepairPlanPanelProps) {
  const steps = diagnosis.recommendedFixes.slice(0, 4);

  return (
    <section className="app-panel min-w-0 flex h-[360px] flex-col rounded-[14px]">
      <div className="border-b border-[color:var(--aegis-line-soft)] px-6 py-4">
        <h2 className="text-[1.05rem] font-semibold tracking-[0.01em] text-white">How to fix it</h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Follow the lowest-risk steps first. Every action here is tied to the evidence above.
        </p>
      </div>

      <div className="hide-scrollbar min-h-0 flex-1 overflow-auto px-4 py-4">
        {steps.length ? (
          <div className="space-y-3">
            {steps.map((fix, index) => (
              <article
                key={fix.id}
                className="flex flex-col gap-4 rounded-[12px] border border-[color:var(--aegis-line-soft)] bg-[rgba(18,28,43,0.64)] px-4 py-3.5 lg:flex-row lg:items-center"
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--aegis-line-soft)] bg-[rgba(118,146,188,0.04)] text-sm font-semibold text-slate-300">
                    {index + 1}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-[1.05rem] font-medium tracking-[0.01em] text-white">
                        {fix.title}
                      </h3>
                      <SafetyPill safety={fix.safety} />
                    </div>
                    <p className="mt-1 max-w-[34rem] text-sm leading-6 text-slate-400">
                      {fix.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => onRunFix(fix)}
                    className="app-outline-button inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-[10px] border-[rgba(62,111,191,0.34)] bg-[rgba(15,35,66,0.56)] px-4 py-2.5 text-sm font-medium text-[#63a5ff]"
                  >
                    {actionLabel(fix)}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-[#54d786]/20 bg-[#54d786]/[0.06] px-4 py-4">
            <p className="font-medium text-[#8ae6af]">No repair action is needed</p>
            <p className="mt-1 text-sm leading-6 text-[#c5f4d6]">
              The diagnostic chain completed without finding a repairable break point.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-[color:var(--aegis-line-soft)] pt-4">
          <button
            type="button"
            onClick={onOpenAdvancedOptions}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#4b8dff] transition hover:text-[#78aaff]"
          >
            View advanced options
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onRunScan}
            disabled={isScanning}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            {isScanning ? "Re-running tests" : "Re-run tests"}
          </button>

          <button
            type="button"
            onClick={onViewReport}
            className="text-sm font-medium text-slate-400 transition hover:text-white"
          >
            Open report
          </button>
        </div>

        {fixResult ? (
          <div className="mt-4 rounded-[16px] border border-[#4b8dff]/25 bg-[#4b8dff]/[0.08] px-4 py-3">
            <p className="font-medium text-white">{fixResult.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{fixResult.message}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
