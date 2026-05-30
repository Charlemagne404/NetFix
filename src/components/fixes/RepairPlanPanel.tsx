import { ArrowRight, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import type {
  FixAction,
  FixExecutionResult,
  OverallDiagnosis
} from "@/core/types";
import { SafetyPill } from "@/components/common/SafetyPill";
import { cn } from "@/utils/cn";

type RepairPlanPanelProps = {
  diagnosis: OverallDiagnosis;
  fixResult: FixExecutionResult | null;
  isScanning: boolean;
  fixesEnabled: boolean;
  fixesDisabledReason?: string;
  scanActionEnabled: boolean;
  scanActionReason?: string;
  onOpenAdvancedOptions: () => void;
  onRunFix: (fix: FixAction) => void;
  onRunScan: () => void;
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
  fixesEnabled,
  fixesDisabledReason,
  scanActionEnabled,
  scanActionReason,
  onOpenAdvancedOptions,
  onRunFix,
  onRunScan
}: RepairPlanPanelProps) {
  const steps = diagnosis.recommendedFixes.slice(0, 4);

  return (
    <section className="app-panel min-w-0 flex h-full min-h-0 flex-col rounded-[14px]">
      <div className="border-b border-[color:var(--aegis-line-soft)] px-6 py-3.5">
        <h2 className="text-[1.02rem] font-semibold tracking-[0.01em] text-white">How to fix it</h2>
        <p className="mt-1 text-[0.92rem] leading-6 text-slate-400">
          Follow the lowest-risk steps first. Every action here is tied to the evidence above.
        </p>
      </div>

      <div className="min-h-0 flex-1 px-4 py-3 sm:px-5">
        {steps.length ? (
          <div className="overflow-hidden rounded-[14px] border border-[color:var(--aegis-line-soft)] bg-[linear-gradient(180deg,rgba(15,24,36,0.88)_0%,rgba(11,20,31,0.94)_100%)] shadow-[inset_0_1px_0_rgba(170,192,224,0.02)]">
            {steps.map((fix, index) => (
              <article
                key={fix.id}
                className={cn(
                  "flex flex-col gap-2 px-4 py-1.5 sm:px-5 lg:flex-row lg:items-center",
                  index !== steps.length - 1 && "border-b border-[color:var(--aegis-line-soft)]"
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--aegis-line-soft)] bg-[rgba(118,146,188,0.05)] text-sm font-semibold text-slate-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[1.02rem] font-medium tracking-[0.01em] text-white">
                      {fix.title}
                    </h3>
                    <p className="mt-1 max-w-[34rem] truncate text-[0.9rem] leading-5 text-slate-400">
                      {fix.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 lg:min-w-[15rem] lg:flex-nowrap">
                  <SafetyPill
                    safety={fix.safety}
                    className="border-transparent bg-transparent px-0 py-0 text-[0.94rem] font-medium capitalize tracking-normal"
                  />
                  <button
                    type="button"
                    onClick={() => onRunFix(fix)}
                    disabled={!fixesEnabled}
                    title={!fixesEnabled ? fixesDisabledReason : undefined}
                    className="app-outline-button inline-flex min-w-[9.5rem] items-center justify-center gap-2 rounded-[8px] border-[rgba(62,111,191,0.4)] bg-[rgba(13,31,56,0.58)] px-4 py-2.5 text-sm font-medium text-[#63a5ff] disabled:cursor-not-allowed disabled:opacity-55"
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

        <div className="mt-3 px-1">
          <button
            type="button"
            onClick={onOpenAdvancedOptions}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#4b8dff] transition hover:text-[#78aaff]"
          >
            View advanced options
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {fixResult ? (
          <div className="mt-3 rounded-[14px] border border-[#4b8dff]/22 bg-[#4b8dff]/[0.08] px-4 py-3">
            <p className="font-medium text-white">{fixResult.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{fixResult.message}</p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--aegis-line-soft)] px-1 pt-3">
          <button
            type="button"
            onClick={onRunScan}
            disabled={isScanning || !scanActionEnabled}
            title={!scanActionEnabled ? scanActionReason : undefined}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            {isScanning ? "Re-running tests" : "Re-run tests"}
          </button>

          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>Was this helpful?</span>
            <span className="inline-flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.07] bg-white/[0.02] text-slate-400">
                <ThumbsUp className="h-4 w-4" />
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.07] bg-white/[0.02] text-slate-400">
                <ThumbsDown className="h-4 w-4" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
