import {
  Activity,
  ArrowDown,
  ArrowUp,
  FileText,
  HardDrive,
  History,
  Home,
  LaptopMinimal,
  Play,
  Settings,
  Shield,
  Stethoscope,
  Wifi,
  Wrench
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  AppMode,
  EnvironmentInfo,
  ScanResult,
  ThemeMode,
  WorkspaceMode
} from "@/core/types";
import { ModeToggle } from "@/components/settings/ModeToggle";
import { cn } from "@/utils/cn";

type FooterMetrics = {
  source: "system" | "browser";
  collectedAt: string | null;
  uptimeSeconds: number | null;
  cpuUsagePercent: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  memoryUsagePercent: number | null;
  downloadBitsPerSecond: number | null;
  uploadBitsPerSecond: number | null;
  cpuHistory: Array<number | null>;
  memoryHistory: Array<number | null>;
};

type AppShellProps = {
  children: ReactNode;
  appVersion: string;
  scan: ScanResult;
  mode: AppMode;
  theme: ThemeMode;
  isScanning: boolean;
  workspaceMode: WorkspaceMode;
  environmentInfo: EnvironmentInfo;
  footerMetrics: FooterMetrics;
  onModeChange: (mode: AppMode) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onRunScan: () => void;
  onExportReport: () => void;
  onOpenSettings: () => void;
};

function formatUptime(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "--";
  }

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${Math.round(value)}%`;
}

function formatBandwidth(bitsPerSecond: number | null) {
  if (bitsPerSecond === null || !Number.isFinite(bitsPerSecond)) {
    return "--";
  }

  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
  }

  if (bitsPerSecond >= 1_000) {
    return `${(bitsPerSecond / 1_000).toFixed(1)} Kbps`;
  }

  return `${Math.round(bitsPerSecond)} bps`;
}

function buildSparklinePoints(values: Array<number | null>) {
  const fallbackY = 11;
  const resolvedValues = values.map((value) => (value === null ? null : Math.max(0, value)));
  const maxValue =
    resolvedValues.reduce<number>((currentMax, value) => {
      if (value === null) {
        return currentMax;
      }

      return Math.max(currentMax, value);
    }, 0) || 100;

  return resolvedValues
    .map((value, index) => {
      const x = 2 + (96 / Math.max(values.length - 1, 1)) * index;
      const ratio = value === null ? null : Math.min(value / maxValue, 1);
      const y = ratio === null ? fallbackY : 11 - ratio * 7;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function FooterSparkline({
  points,
  strokeClassName
}: {
  points: string;
  strokeClassName?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 14"
      aria-hidden="true"
      className={cn("h-3.5 w-[70px]", strokeClassName)}
      fill="none"
    >
      <path
        d={`M ${points.split(" ").join(" L ")}`}
        className="opacity-95"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function FooterSegment({
  label,
  children,
  className
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-w-0 shrink-0 items-center gap-2.5 whitespace-nowrap border-r border-[color:var(--aegis-line-soft)] px-4 first:pl-0 last:border-r-0 last:pr-0",
        className
      )}
    >
      {label ? (
        <span className="text-[0.9rem] font-normal tracking-[0.01em] text-slate-500">{label}</span>
      ) : null}
      {children}
    </div>
  );
}

export function AppShell({
  children,
  appVersion,
  scan,
  mode,
  theme,
  isScanning,
  workspaceMode,
  environmentInfo,
  footerMetrics,
  onModeChange,
  onThemeChange,
  onRunScan,
  onExportReport,
  onOpenSettings
}: AppShellProps) {
  const cpuSparkPoints = buildSparklinePoints(footerMetrics.cpuHistory);
  const memorySparkPoints = buildSparklinePoints(footerMetrics.memoryHistory);
  const footerStatusLabel = footerMetrics.source === "system" ? "Live metrics" : "Browser metrics";
  const footerStatusDotClassName =
    footerMetrics.source === "system" ? "bg-[#54d786]" : "bg-[#f2b84b]";

  const navItems = [
    {
      label: "Overview",
      description: "Current diagnosis, confidence, and scan controls.",
      icon: Home,
      active: true
    },
    {
      label: "Timeline",
      description: "Trace the connection chain from device to app layer.",
      icon: Stethoscope
    },
    {
      label: "Findings",
      description: "Review evidence, likely causes, and user-facing impact.",
      icon: Activity
    },
    {
      label: "Repair Plan",
      description: "Follow the safest allowlisted fixes first.",
      icon: Wrench
    },
    {
      label: "Verification",
      description: "Compare before and after scans to confirm improvement.",
      icon: Shield
    },
    {
      label: "Local Reports",
      description: "Export a case file that stays on this device.",
      icon: FileText
    },
    {
      label: "Scan History",
      description: "Restore previous timelines and repair outcomes.",
      icon: History
    }
  ];

  const workspaceSummary = {
    live: {
      badge: "Live Windows device",
      title: scan.environment.hostname ?? "Windows desktop",
      description: "Allowlisted diagnostics and repair actions are available.",
      accentClassName: "text-[#54d786]",
      dotClassName: "bg-[#54d786]"
    },
    preview: {
      badge: "Preview workspace",
      title: scan.environment.hostname ?? "Local preview",
      description: "Aegis is using preview data until the Windows desktop runtime is available.",
      accentClassName: "text-[#f2b84b]",
      dotClassName: "bg-[#f2b84b]"
    },
    lab: {
      badge: "Diagnostic lab",
      title: "Scenario replay active",
      description: "Replay failures and simulated repair outcomes without touching the device.",
      accentClassName: "text-[#63a5ff]",
      dotClassName: "bg-[#63a5ff]"
    }
  }[workspaceMode];

  return (
    <div
      className={cn(
        "h-dvh max-h-dvh overflow-hidden bg-[#08111b] text-slate-100 antialiased"
      )}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(31,110,255,0.12),transparent_24%),radial-gradient(circle_at_70%_0%,rgba(72,132,255,0.07),transparent_20%),linear-gradient(180deg,#09111b_0%,#0b1220_100%)]" />

      <div className="relative mx-auto h-full max-w-[1680px] overflow-hidden">
        <div className="grid h-full lg:grid-cols-[248px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto]">
          <aside className="min-h-0 border-b border-[color:var(--aegis-line)] bg-[#09111c]/92 px-3 py-4 lg:row-span-2 lg:flex lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-4 px-3 pb-5">
                <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-[#1f66d8]/30 bg-[linear-gradient(180deg,rgba(19,38,69,0.92)_0%,rgba(10,22,40,0.98)_100%)] text-[#63a5ff] shadow-[0_0_30px_rgba(75,141,255,0.14)]">
                  <Shield className="h-6 w-6" strokeWidth={1.7} />
                </div>
                <div>
                  <h1 className="text-[1.02rem] font-semibold tracking-[0.01em] text-white">Aegis</h1>
                  <p className="mt-0.5 text-[0.98rem] text-slate-300">Trace</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-[14px] border border-[color:var(--aegis-line-soft)] bg-[rgba(20,30,45,0.68)] px-4 py-3 lg:hidden">
                <div>
                  <p className="text-sm text-slate-400">Workspace</p>
                  <p className="text-[1.02rem] font-medium text-white">Diagnosis</p>
                </div>
                <button
                  type="button"
                  onClick={() => onModeChange(mode === "technician" ? "normal" : "technician")}
                  className={cn(
                    "relative h-7 w-12 rounded-full transition",
                    mode === "technician" ? "bg-[#2f7dff]" : "bg-[#253042]"
                  )}
                  aria-pressed={mode === "technician"}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-5 w-5 rounded-full bg-white transition",
                      mode === "technician" ? "left-6" : "left-1"
                    )}
                  />
                </button>
              </div>

              <nav className="hide-scrollbar mt-2 hidden min-h-0 flex-1 space-y-2 overflow-y-auto border-t border-[color:var(--aegis-line-soft)] pt-4 lg:block">
                {navItems.map(({ label, description, icon: Icon, active }) => (
                  <div
                    key={label}
                    className={cn(
                      "rounded-[14px] border px-4 py-3",
                      active
                        ? "border-[rgba(78,122,191,0.28)] bg-[rgba(20,32,49,0.74)] shadow-[inset_2px_0_0_#2f7dff]"
                        : "border-[color:var(--aegis-line-soft)] bg-[rgba(10,18,29,0.44)]"
                    )}
                  >
                    <div className="flex items-center gap-3 text-white">
                      <Icon className="h-4.5 w-4.5 text-slate-300" strokeWidth={1.8} />
                      <span className="text-[0.95rem] font-medium">{label}</span>
                    </div>
                    <p className="mt-2 text-[0.82rem] leading-5 text-slate-400">{description}</p>
                  </div>
                ))}
              </nav>
            </div>

            <div className="app-panel-soft mt-4 hidden rounded-[14px] px-4 py-3.5 lg:block">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-slate-200">
                  <Wifi className="h-5 w-5 text-slate-300" />
                  <div>
                    <p className="text-[0.96rem] font-medium">{workspaceSummary.title}</p>
                    <p className="text-sm text-slate-400">{workspaceSummary.description}</p>
                  </div>
                </div>
                <span className={cn("h-2.5 w-2.5 rounded-full", workspaceSummary.dotClassName)} />
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-slate-300">
                <span className={workspaceSummary.accentClassName}>{workspaceSummary.badge}</span>
                <span>{environmentInfo.os}</span>
                {environmentInfo.isAdmin ? <span>Elevated</span> : <span>Standard access</span>}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[0.96rem] text-slate-200">Technician Mode</span>
                <button
                  type="button"
                  onClick={() => onModeChange(mode === "technician" ? "normal" : "technician")}
                  className={cn(
                    "relative h-7 w-12 rounded-full transition",
                    mode === "technician" ? "bg-[#2f7dff]" : "bg-[#253042]"
                  )}
                  aria-pressed={mode === "technician"}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-5 w-5 rounded-full bg-white transition",
                      mode === "technician" ? "left-6" : "left-1"
                    )}
                  />
                </button>
              </div>

              <div className="mt-4 rounded-[12px] border border-[color:var(--aegis-line-soft)] bg-black/10 px-3.5 py-3">
                <p className="text-[0.82rem] uppercase tracking-[0.14em] text-slate-500">
                  Timeline focus
                </p>
                <p className="mt-2 text-[0.95rem] font-medium text-white">
                  {scan.diagnosis.primaryFailedNodeId
                    ? "The current workspace is centered on the first failed stage."
                    : "The timeline completed without a failed stage."}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Aegis keeps the break point obvious first, then opens deeper evidence for technician review.
                </p>
              </div>
            </div>
          </aside>

          <header className="min-w-0 border-b border-white/8 bg-[#0a1320]/95 px-4 sm:px-6 lg:px-7">
            <div className="flex min-h-[76px] flex-col justify-center gap-3 xl:min-h-[80px] xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-[14px] border border-white/8 bg-white/[0.02] text-slate-300">
                  <LaptopMinimal className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-500">System</p>
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[1.04rem] font-medium tracking-[0.01em] text-white">
                      {scan.environment.hostname ?? "DESKTOP-AEGIS"}
                    </p>
                    <span className={cn("h-1.5 w-1.5 rounded-full", workspaceSummary.dotClassName)} />
                    <p className="truncate text-[0.92rem] text-slate-400">{workspaceSummary.badge}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
                <ModeToggle mode={mode} onChange={onModeChange} />
                <button
                  type="button"
                  onClick={onRunScan}
                  disabled={isScanning}
                  className="app-outline-button inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play className="h-4 w-4 text-[#4b8dff]" strokeWidth={1.8} />
                  {isScanning ? "Running scan" : "Run scan"}
                </button>
                <button
                  type="button"
                  onClick={onExportReport}
                  className="app-icon-button"
                  aria-label="Export report"
                >
                  <HardDrive className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="app-icon-button"
                  aria-label="Open settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          <main className="hide-scrollbar min-h-0 min-w-0 overscroll-contain overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 lg:px-6 lg:py-3">
            {children}
          </main>

          <footer className="min-w-0 shrink-0 overflow-hidden border-t border-[color:var(--aegis-line)] bg-[linear-gradient(180deg,rgba(12,18,29,0.98)_0%,rgba(8,15,25,0.98)_100%)] px-4 sm:px-6 lg:col-span-2">
            <div className="hide-scrollbar flex min-h-[54px] items-center overflow-x-auto text-[0.89rem] text-slate-300 2xl:grid 2xl:grid-cols-[1.35fr_1.15fr_1fr_1fr_1.1fr_1.7fr_1.15fr] 2xl:overflow-visible">
              <FooterSegment className="min-w-[164px] 2xl:min-w-0">
                <span className="font-normal tracking-[0.01em] text-slate-300">Aegis Trace</span>
              </FooterSegment>

              <FooterSegment className="min-w-[150px] 2xl:min-w-0">
                <span className="text-slate-400">Version {appVersion}</span>
              </FooterSegment>

              <FooterSegment label="Uptime" className="min-w-[148px] 2xl:min-w-0">
                <span className="text-slate-300">{formatUptime(footerMetrics.uptimeSeconds)}</span>
              </FooterSegment>

              <FooterSegment label="CPU" className="min-w-[142px] 2xl:min-w-0">
                <span className="text-slate-200">
                  {formatPercent(footerMetrics.cpuUsagePercent)}
                </span>
                <FooterSparkline
                  points={cpuSparkPoints}
                  strokeClassName="text-slate-500/90"
                />
              </FooterSegment>

              <FooterSegment label="Memory" className="min-w-[160px] 2xl:min-w-0">
                <span className="text-slate-200">
                  {formatPercent(footerMetrics.memoryUsagePercent)}
                </span>
                <FooterSparkline
                  points={memorySparkPoints}
                  strokeClassName="text-slate-500/90"
                />
              </FooterSegment>

              <FooterSegment label="Network" className="min-w-[224px] 2xl:min-w-0">
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <span className="text-slate-300">
                    {formatBandwidth(footerMetrics.downloadBitsPerSecond)}
                  </span>
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.7} />
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  {formatBandwidth(footerMetrics.uploadBitsPerSecond)}
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.7} />
                </span>
              </FooterSegment>

              <FooterSegment className="min-w-[146px] justify-end 2xl:min-w-0">
                <span className="text-[0.9rem] font-normal tracking-[0.01em] text-slate-500">Status</span>
                <span className={cn("h-2.5 w-2.5 rounded-full", footerStatusDotClassName)} />
                <span className="text-slate-300">{footerStatusLabel}</span>
              </FooterSegment>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
