import { AlertCircle, ChevronDown, Play, Wifi } from "lucide-react";
import { motion } from "framer-motion";
import type { OverallDiagnosis, ScanProgress } from "@/core/types";
import { cn } from "@/utils/cn";
import { severityLabels } from "@/utils/status";

type StatusOverviewProps = {
  diagnosis: OverallDiagnosis;
  completedChecks: number;
  lastRunAt: string;
  isScanning: boolean;
  scanProgress?: ScanProgress;
  totalTimelineNodes: number;
  onRunScan: () => void;
  onViewReport: () => void;
};

export function StatusOverview({
  diagnosis,
  completedChecks,
  lastRunAt,
  isScanning,
  scanProgress,
  totalTimelineNodes,
  onRunScan
}: StatusOverviewProps) {
  const isProblemState = !["info", "low"].includes(diagnosis.severity);
  const statusHeadline = isProblemState ? "Problems detected" : "Connection looks healthy";
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
  const stageNumber =
    isScanning && typeof scanProgress?.nodeIndex === "number"
      ? Math.min(scanProgress.nodeIndex + 1, totalTimelineNodes)
      : undefined;
  const progressLabel = stageNumber
    ? `Stage ${stageNumber} of ${totalTimelineNodes}`
    : `Preparing ${totalTimelineNodes}-stage timeline`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="app-panel relative min-w-0 overflow-hidden rounded-[14px] px-5 py-4"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(255,103,86,0.08),transparent_24%),radial-gradient(circle_at_100%_0%,rgba(49,116,255,0.06),transparent_28%)]" />

      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.58fr)_minmax(0,0.8fr)_minmax(0,0.95fr)_minmax(248px,0.9fr)] xl:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={cn(
              "relative grid h-[82px] w-[82px] shrink-0 place-items-center rounded-full border shadow-[0_0_44px_rgba(255,106,90,0.08)]",
              isProblemState
                ? "border-[#ff6a5a]/35 bg-[#ff6a5a]/[0.05] text-[#ff6a5a]"
                : "border-[#54d786]/30 bg-[#54d786]/[0.05] text-[#54d786]"
            )}
          >
            {isProblemState ? (
              <>
                <Wifi className="h-10 w-10" strokeWidth={1.8} />
                <span className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full border border-[#ff6a5a] bg-[#111c2c] text-[#ff6a5a] shadow-[0_0_24px_rgba(255,98,87,0.18)]">
                  <AlertCircle className="h-4 w-4" strokeWidth={2} />
                </span>
              </>
            ) : (
              <Wifi className="h-10 w-10" strokeWidth={1.8} />
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-[1.7rem] font-semibold tracking-[-0.02em] text-white">
              {isScanning ? "Running diagnostics" : statusHeadline}
            </h2>
            <p className="mt-1.5 max-w-[34rem] text-[0.97rem] leading-7 text-slate-300">
              {isScanning
                ? scanProgress?.message ??
                  "Aegis is stepping through the connection chain live so the timeline follows the real scan."
                : diagnosis.summary}
            </p>
          </div>
        </div>

        <div className="border-[color:var(--aegis-line)] xl:border-l xl:pl-8">
          <p className="text-[0.96rem] text-slate-400">Severity</p>
          <div className="mt-3 flex items-center gap-4">
            <p
              className={cn(
                "text-[1.2rem] font-medium tracking-[-0.02em]",
                isProblemState ? "text-[#ff6a5a]" : "text-[#54d786]"
              )}
            >
              {severityLabels[diagnosis.severity]}
            </p>
            <div className="flex gap-1.5">
              {Array.from({ length: 8 }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-[7px] w-6 rounded-full xl:w-7",
                    index < severityBars
                      ? isProblemState
                        ? "bg-[#ff6257] shadow-[0_0_10px_rgba(255,98,87,0.16)]"
                        : "bg-[#54d786] shadow-[0_0_10px_rgba(84,215,134,0.14)]"
                      : "bg-[#263349]"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="border-[color:var(--aegis-line)] xl:border-l xl:pl-8">
          <p className="text-[0.96rem] text-slate-400">
            {isScanning ? "Live progress" : "Diagnostics completed"}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.98rem] text-slate-200">
            {isScanning ? (
              <>
                <span>{progressLabel}</span>
                <span className="text-slate-500">|</span>
                <span>{scanProgress?.nodeLabel ?? "Loading scan stages"}</span>
              </>
            ) : (
              <>
                <span>{completedChecks} tests run</span>
                <span className="text-slate-500">|</span>
                <span>Duration: 00:{durationSeconds}</span>
              </>
            )}
          </div>
        </div>

        <div className="xl:justify-self-end">
          <p className="text-right text-[0.92rem] text-slate-400">Last run: Today, {lastRunLabel}</p>
          <button
            type="button"
            onClick={onRunScan}
            disabled={isScanning}
            className="app-primary-button mt-3 inline-flex min-h-[42px] w-full items-center justify-between overflow-hidden rounded-[8px] border-[#2c74e5] px-0 text-[0.96rem] font-medium disabled:cursor-not-allowed disabled:opacity-60 xl:min-w-[248px]"
          >
            <span className="inline-flex flex-1 items-center justify-center gap-3 px-5">
              <Play className={cn("h-4 w-4", isScanning && "animate-pulse")} fill="currentColor" />
              {isScanning ? "Running scan" : "Run scan"}
            </span>
            <span className="flex h-full items-center border-l border-white/10 px-3.5 text-white/75">
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>
    </motion.section>
  );
}
