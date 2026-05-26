import type { DiagnosticStatus, FixSafety, Severity } from "@/core/types";

export const statusLabels: Record<DiagnosticStatus, string> = {
  ok: "Passed",
  warning: "Warning",
  failed: "Failed",
  unknown: "Unknown",
  skipped: "Skipped",
  pending: "Pending",
  running: "Running"
};

export const statusTone: Record<DiagnosticStatus, string> = {
  ok: "text-emerald-200 bg-emerald-400/10 border-emerald-300/25",
  warning: "text-amber-200 bg-amber-400/10 border-amber-300/25",
  failed: "text-rose-200 bg-rose-400/10 border-rose-300/30",
  unknown: "text-slate-300 bg-slate-400/10 border-slate-300/15",
  skipped: "text-slate-400 bg-slate-500/10 border-slate-400/15",
  pending: "text-slate-300 bg-slate-400/10 border-slate-300/15",
  running: "text-cyan-100 bg-cyan-400/10 border-cyan-300/30"
};

export const statusGlow: Record<DiagnosticStatus, string> = {
  ok: "shadow-[0_0_32px_rgba(68,224,165,.22)]",
  warning: "shadow-[0_0_32px_rgba(251,191,36,.2)]",
  failed: "shadow-[0_0_42px_rgba(251,113,133,.32)]",
  unknown: "",
  skipped: "",
  pending: "",
  running: "shadow-[0_0_42px_rgba(56,213,255,.28)]"
};

export const severityLabels: Record<Severity, string> = {
  info: "Info",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical"
};

export const safetyTone: Record<FixSafety, string> = {
  safe: "text-emerald-100 bg-emerald-400/10 border-emerald-300/25",
  moderate: "text-amber-100 bg-amber-400/10 border-amber-300/25",
  aggressive: "text-rose-100 bg-rose-400/10 border-rose-300/30"
};

export function isProblemStatus(status: DiagnosticStatus): boolean {
  return status === "failed" || status === "warning";
}
