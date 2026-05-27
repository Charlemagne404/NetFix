import { Activity, ArrowRight, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { FixExecutionResult, RepairVerification } from "@/core/types";
import { StatusPill } from "@/components/common/StatusPill";
import { cn } from "@/utils/cn";

type RepairVerificationPanelProps = {
  verification: RepairVerification | null;
  fixResult: FixExecutionResult | null;
  isVerifying: boolean;
};

const verificationTone: Record<
  NonNullable<RepairVerification>["status"],
  { icon: typeof ShieldCheck; badge: string; body: string; label: string }
> = {
  resolved: {
    icon: ShieldCheck,
    badge: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    body: "border-emerald-300/20 bg-emerald-400/[0.07]",
    label: "Resolved"
  },
  improved: {
    icon: ShieldCheck,
    badge: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
    body: "border-cyan-300/20 bg-cyan-400/[0.07]",
    label: "Improved"
  },
  unchanged: {
    icon: ShieldAlert,
    badge: "border-amber-300/25 bg-amber-400/10 text-amber-100",
    body: "border-amber-300/20 bg-amber-400/[0.07]",
    label: "Unchanged"
  },
  worse: {
    icon: ShieldX,
    badge: "border-rose-300/25 bg-rose-400/10 text-rose-100",
    body: "border-rose-300/20 bg-rose-400/[0.07]",
    label: "Worse"
  },
  blocked: {
    icon: ShieldAlert,
    badge: "border-slate-300/15 bg-slate-400/10 text-slate-200",
    body: "border-slate-300/15 bg-slate-400/[0.06]",
    label: "Blocked"
  }
};

function transitionLabel(status: RepairVerification["status"]) {
  if (status === "resolved") return "The timeline is healthy again.";
  if (status === "improved") return "The failure path shortened after the fix.";
  if (status === "worse") return "The verification scan found a broader break.";
  if (status === "blocked") return "The repair did not run, so no verification scan followed.";
  return "The repair ran, but the visible break point did not move.";
}

export function RepairVerificationPanel({
  verification,
  fixResult,
  isVerifying
}: RepairVerificationPanelProps) {
  if (!verification && !isVerifying && !fixResult) {
    return (
      <section className="app-panel min-w-0 rounded-[14px]">
        <div className="border-b border-[color:var(--aegis-line-soft)] px-5 py-4">
          <h2 className="text-[1rem] font-semibold tracking-[0.01em] text-white">
            Repair verification
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            After each repair, Aegis can rerun the timeline and compare the break point before and after the fix.
          </p>
        </div>

        <div className="px-5 py-5">
          <div className="rounded-[14px] border border-dashed border-[color:var(--aegis-line-soft)] bg-[rgba(15,24,36,0.52)] px-4 py-6 text-center">
            <p className="font-medium text-white">No repair verification yet</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Run a recommended repair and Aegis will automatically rescan to verify whether the timeline improved.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (isVerifying) {
    return (
      <section className="app-panel min-w-0 rounded-[14px]">
        <div className="border-b border-[color:var(--aegis-line-soft)] px-5 py-4">
          <h2 className="text-[1rem] font-semibold tracking-[0.01em] text-white">
            Repair verification
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            The fix finished. Aegis is rerunning the timeline now to confirm whether the break point moved.
          </p>
        </div>

        <div className="px-5 py-5">
          <div className="rounded-[14px] border border-cyan-300/20 bg-cyan-400/[0.07] px-4 py-5">
            <div className="flex items-center gap-3 text-cyan-100">
              <Activity className="h-5 w-5 animate-pulse" />
              <p className="font-medium text-white">Verifying repair outcome</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Aegis is collecting a fresh scan so the next recommendation is based on the new network state, not the old one.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const tone = verification ? verificationTone[verification.status] : null;
  const Icon = tone?.icon ?? ShieldAlert;

  return (
    <section className="app-panel min-w-0 rounded-[14px]">
      <div className="border-b border-[color:var(--aegis-line-soft)] px-5 py-4">
        <h2 className="text-[1rem] font-semibold tracking-[0.01em] text-white">
          Repair verification
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Aegis compares the timeline before and after each repair so you can see whether the safest fix actually helped.
        </p>
      </div>

      {verification && tone ? (
        <div className="space-y-4 px-5 py-5">
          <div className={cn("rounded-[14px] border px-4 py-4", tone.body)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                      tone.badge
                    )}
                  >
                    {tone.label}
                  </span>
                  <p className="text-sm text-slate-400">{verification.fixTitle}</p>
                </div>

                <p className="mt-3 text-[0.98rem] font-medium text-white">
                  {verification.summary}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {verification.detail}
                </p>
              </div>

              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-black/20 text-white">
                <Icon className="h-5 w-5" />
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              {transitionLabel(verification.status)}
            </p>
          </div>

          {verification.afterDiagnosis ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[14px] border border-[color:var(--aegis-line-soft)] bg-[rgba(15,24,36,0.62)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Before repair
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {verification.beforeDiagnosis}
                </p>
              </div>
              <div className="rounded-[14px] border border-[color:var(--aegis-line-soft)] bg-[rgba(15,24,36,0.62)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  After repair
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {verification.afterDiagnosis}
                </p>
              </div>
            </div>
          ) : null}

          {verification.changedNodes.length ? (
            <div className="rounded-[14px] border border-[color:var(--aegis-line-soft)] bg-[rgba(15,24,36,0.62)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Changed timeline stages
              </p>
              <div className="mt-3 space-y-3">
                {verification.changedNodes.slice(0, 4).map((transition) => (
                  <div
                    key={transition.nodeId}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{transition.label}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {transition.afterSummary}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill status={transition.beforeStatus} />
                      <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                      <StatusPill status={transition.afterStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {fixResult ? (
            <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-sm font-medium text-white">Execution result</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">{fixResult.message}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
