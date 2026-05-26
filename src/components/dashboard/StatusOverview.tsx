import { Activity, ArrowRight, FileText, ShieldAlert, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import type { OverallDiagnosis } from "@/core/types";
import { SafetyPill } from "@/components/common/SafetyPill";
import { cn } from "@/utils/cn";
import { severityLabels } from "@/utils/status";

type StatusOverviewProps = {
  diagnosis: OverallDiagnosis;
  isScanning: boolean;
  onRunScan: () => void;
  onApplyRecommendedFix: () => void;
  onViewReport: () => void;
};

export function StatusOverview({
  diagnosis,
  isScanning,
  onRunScan,
  onApplyRecommendedFix,
  onViewReport
}: StatusOverviewProps) {
  const recommendedFix = diagnosis.recommendedFixes[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-panel backdrop-blur-2xl"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(56,213,255,.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,.055),transparent_42%)]" />
      <div className="absolute right-6 top-6 hidden h-28 w-28 rounded-full border border-cyan-300/20 bg-cyan-300/5 shadow-glow lg:block" />

      <div className="relative grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Live diagnosis
            </span>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300">
              Severity: {severityLabels[diagnosis.severity]}
            </span>
          </div>

          <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            {isScanning ? "Tracing the connection chain" : diagnosis.title}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            {isScanning
              ? "Aegis is checking each stage in order so the recommended repair is tied to evidence, not a blanket reset."
              : diagnosis.summary}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRunScan}
              disabled={isScanning}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Activity className={cn("h-4 w-4", isScanning && "animate-pulse")} />
              {isScanning ? "Scanning" : "Run Scan Again"}
            </button>
            <button
              type="button"
              onClick={onApplyRecommendedFix}
              disabled={!recommendedFix || isScanning}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-200/50 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply Safe Fix
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onViewReport}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <FileText className="h-4 w-4" />
              View Report
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">Confidence</p>
              <p className="mt-1 text-5xl font-semibold tracking-[-0.06em] text-white">
                {diagnosis.confidence}%
              </p>
            </div>
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
              <ShieldAlert className="h-7 w-7" strokeWidth={1.7} />
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400"
              initial={{ width: 0 }}
              animate={{ width: `${diagnosis.confidence}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>

          {recommendedFix ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Recommended
                </p>
                <SafetyPill safety={recommendedFix.safety} />
              </div>
              <p className="font-semibold text-white">{recommendedFix.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {recommendedFix.estimatedImpact}
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
              No repair action is recommended for this scan.
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
