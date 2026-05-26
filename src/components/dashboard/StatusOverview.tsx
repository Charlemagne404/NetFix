import { AlertCircle, ChevronDown, Play, Wifi } from "lucide-react";
import { motion } from "framer-motion";
import type { OverallDiagnosis } from "@/core/types";
import { cn } from "@/utils/cn";
import { severityLabels } from "@/utils/status";

type StatusOverviewProps = {
  diagnosis: OverallDiagnosis;
  completedChecks: number;
  lastRunAt: string;
  isScanning: boolean;
  onRunScan: () => void;
  onViewReport: () => void;
};

export function StatusOverview({
  diagnosis,
  completedChecks,
  lastRunAt,
  isScanning,
  onRunScan,
  onViewReport
}: StatusOverviewProps) {
  const statusHeadline =
    diagnosis.severity === "info" || diagnosis.severity === "low"
      ? "Connection looks healthy"
      : "Problems detected";
  const severityBars = {
    info: 2,
    low: 3,
    medium: 4,
    high: 5,
    critical: 6
  }[diagnosis.severity];
  const lastRunLabel = new Date(lastRunAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
  const durationSeconds = Math.max(8.2, completedChecks * 0.68).toFixed(1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="app-panel min-w-0 overflow-hidden rounded-[14px] px-6 py-5"
    >
      <div className="grid gap-5 2xl:grid-cols-[1.72fr_0.95fr_1.08fr_auto] 2xl:items-center">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-[82px] w-[82px] place-items-center rounded-full border border-[#ff6a5a]/30 bg-[#ff6a5a]/[0.05] text-[#ff6a5a] shadow-[0_0_36px_rgba(255,106,90,0.1)]">
            {diagnosis.severity === "high" || diagnosis.severity === "critical" ? (
              <AlertCircle className="h-10 w-10" strokeWidth={1.7} />
            ) : (
              <Wifi className="h-10 w-10" strokeWidth={1.7} />
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-[1.12rem] font-semibold tracking-[0.01em] text-white 2xl:text-[1.2rem]">
              {isScanning ? "Running diagnostics" : statusHeadline}
            </h2>
            <p className="mt-2 max-w-[33rem] text-[0.98rem] leading-7 text-slate-300">
              {isScanning
                ? "Aegis is stepping through the connection chain so the recommendation stays tied to the actual break point."
                : diagnosis.summary}
            </p>
          </div>
        </div>

        <div className="border-[color:var(--aegis-line)] 2xl:border-l 2xl:pl-8">
          <p className="text-sm text-slate-400">Severity</p>
          <div className="mt-2 flex items-center gap-4">
            <p className="text-[1.55rem] font-medium text-[#ff6a5a]">
              {severityLabels[diagnosis.severity]}
            </p>
            <div className="flex gap-1.5">
              {Array.from({ length: 7 }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-2.5 w-8 rounded-full",
                    index < severityBars ? "bg-[#ff6257]" : "bg-[#263348]"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="border-[color:var(--aegis-line)] 2xl:border-l 2xl:pl-8">
          <p className="text-sm text-slate-400">Diagnostics completed</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[1.02rem] text-slate-200">
            <span>{completedChecks} tests run</span>
            <span className="text-slate-500">|</span>
            <span>Duration: 00:{durationSeconds}</span>
          </div>
        </div>

        <div className="2xl:justify-self-end">
          <p className="text-right text-sm text-slate-400">Last run: Today, {lastRunLabel}</p>
          <div className="mt-3 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onViewReport}
              className="app-outline-button rounded-[12px] px-4 py-2.5 text-sm font-medium"
            >
              Report
            </button>
            <button
              type="button"
              onClick={onRunScan}
              disabled={isScanning}
              className="app-primary-button inline-flex items-center gap-3 rounded-[12px] px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play className={cn("h-4 w-4", isScanning && "animate-pulse")} fill="currentColor" />
              {isScanning ? "Running" : "Run Diagnosis"}
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
