import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bell,
  ChevronDown,
  FileText,
  Globe,
  Gauge,
  HardDrive,
  HeartPulse,
  HelpCircle,
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
import type { AppMode, MockScenarioId, ScanResult, ThemeMode } from "@/core/types";
import { ModeToggle } from "@/components/settings/ModeToggle";
import { ScenarioSwitcher } from "@/components/settings/ScenarioSwitcher";
import { cn } from "@/utils/cn";

type AppShellProps = {
  children: ReactNode;
  scan: ScanResult;
  mode: AppMode;
  theme: ThemeMode;
  scenarioId: MockScenarioId;
  isScanning: boolean;
  demoMode: boolean;
  onModeChange: (mode: AppMode) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onScenarioChange: (scenario: MockScenarioId) => void;
  onRunScan: () => void;
  onExportReport: () => void;
  onOpenSettings: () => void;
};

const FOOTER_CPU_SPARK = "2,11 12,11 20,10 28,11 36,11 45,10 52,11 60,4 68,4 76,11 88,11 98,10";
const FOOTER_MEMORY_SPARK =
  "2,11 14,11 24,11 32,7 40,11 50,11 60,10 68,4 76,4 84,11 92,11 98,10";

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
  scan,
  mode,
  theme,
  scenarioId,
  isScanning,
  demoMode,
  onModeChange,
  onThemeChange,
  onScenarioChange,
  onRunScan,
  onExportReport,
  onOpenSettings
}: AppShellProps) {
  const navItems = [
    { label: "Overview", icon: Home },
    { label: "Diagnosis", icon: Stethoscope, active: true },
    { label: "Connectivity Tests", icon: Activity },
    { label: "Wi-Fi Advisor", icon: Wifi },
    { label: "DNS Toolkit", icon: Globe },
    { label: "Traffic Monitor", icon: HeartPulse },
    { label: "System Insights", icon: Gauge },
    { label: "Reports", icon: FileText },
    { label: "Tools", icon: Wrench },
    { label: "Settings", icon: Settings }
  ];

  return (
    <div className={cn("min-h-screen overflow-x-hidden bg-[#08111b] text-slate-100 antialiased")}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(31,110,255,0.12),transparent_24%),radial-gradient(circle_at_70%_0%,rgba(72,132,255,0.07),transparent_20%),linear-gradient(180deg,#09111b_0%,#0b1220_100%)]" />

      <div className="relative mx-auto h-screen max-w-[1720px]">
        <div className="grid h-screen lg:grid-cols-[260px_1fr] lg:grid-rows-[82px_minmax(0,1fr)_60px]">
          <aside className="border-b border-[color:var(--aegis-line)] bg-[#09111c]/92 px-3 py-5 lg:row-span-2 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-4 px-3 pb-6">
              <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-[#1f66d8]/30 bg-[linear-gradient(180deg,rgba(19,38,69,0.92)_0%,rgba(10,22,40,0.98)_100%)] text-[#63a5ff] shadow-[0_0_30px_rgba(75,141,255,0.14)]">
                <Shield className="h-6 w-6" strokeWidth={1.7} />
              </div>
              <div>
                <h1 className="text-[1.02rem] font-semibold tracking-[0.01em] text-white">Aegis</h1>
                <p className="mt-0.5 text-[0.98rem] text-slate-300">Network Doctor</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-[14px] border border-[color:var(--aegis-line-soft)] bg-[rgba(20,30,45,0.68)] px-4 py-3 lg:hidden">
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

            <nav className="mt-2 hidden space-y-1 border-t border-[color:var(--aegis-line-soft)] pt-5 lg:block">
              {navItems.map(({ label, icon: Icon, active }) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[12px] px-4 py-3 text-left text-[1rem] transition",
                    active
                      ? "border border-[rgba(78,122,191,0.28)] bg-[rgba(20,32,49,0.74)] text-white shadow-[inset_2px_0_0_#2f7dff]"
                      : "text-slate-300 hover:bg-[rgba(122,149,191,0.05)] hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                  <span>{label}</span>
                  {label === "Tools" ? (
                    <ChevronDown className="ml-auto h-4 w-4 text-slate-500" />
                  ) : null}
                </button>
              ))}
            </nav>

            <div className="app-panel-soft mt-6 hidden rounded-[14px] px-4 py-4 lg:block">
              <div className="flex items-center gap-3 text-slate-200">
                <Wifi className="h-5 w-5 text-slate-300" />
                <div>
                  <p className="text-[1.02rem] font-medium">Intel(R) Wi-Fi 6E AX211</p>
                  <p className="text-sm text-slate-400">Connected to HomeNet</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-slate-300">
                <span>5 GHz</span>
                <span>866 Mbps</span>
                {demoMode ? <span className="text-[#63a5ff]">Mock</span> : null}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-[1.02rem] text-slate-200">Technician Mode</span>
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
            </div>
          </aside>

          <header className="min-w-0 border-b border-white/8 bg-[#0a1320]/95 px-7">
            <div className="flex min-h-[82px] flex-col justify-center gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
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
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <ScenarioSwitcher value={scenarioId} onChange={onScenarioChange} compact />
                <ModeToggle mode={mode} onChange={onModeChange} />
                <button
                  type="button"
                  onClick={onRunScan}
                  disabled={isScanning}
                  className="app-outline-button inline-flex items-center gap-2 rounded-[10px] px-4 py-3 text-[0.98rem] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play className="h-4 w-4 text-[#4b8dff]" strokeWidth={1.8} />
                  {isScanning ? "Running Tests" : "Run Tests"}
                  <ChevronDown className="h-4 w-4 text-slate-500" />
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
                <button
                  type="button"
                  className="app-icon-button"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="app-icon-button"
                  aria-label="Help"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          <main className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-5 py-4 lg:px-7 lg:py-4">
            {children}
          </main>

          <footer className="min-w-0 overflow-hidden border-t border-[color:var(--aegis-line)] bg-[linear-gradient(180deg,rgba(12,18,29,0.98)_0%,rgba(8,15,25,0.98)_100%)] px-6 lg:col-span-2">
            <div className="hide-scrollbar flex min-h-[60px] items-center overflow-x-auto text-[0.92rem] text-slate-300 2xl:grid 2xl:grid-cols-[1.35fr_1.15fr_1fr_1fr_1.1fr_1.7fr_1.15fr] 2xl:overflow-visible">
              <FooterSegment className="min-w-[164px] 2xl:min-w-0">
                <span className="font-normal tracking-[0.01em] text-slate-300">Aegis Network Doctor</span>
              </FooterSegment>

              <FooterSegment className="min-w-[150px] 2xl:min-w-0">
                <span className="text-slate-400">Version {scan.environment.appVersion}</span>
              </FooterSegment>

              <FooterSegment label="Uptime" className="min-w-[148px] 2xl:min-w-0">
                <span className="text-slate-300">2d 14h 22m</span>
              </FooterSegment>

              <FooterSegment label="CPU" className="min-w-[142px] 2xl:min-w-0">
                <span className="text-slate-200">8%</span>
                <FooterSparkline
                  points={FOOTER_CPU_SPARK}
                  strokeClassName="text-slate-500/90"
                />
              </FooterSegment>

              <FooterSegment label="Memory" className="min-w-[160px] 2xl:min-w-0">
                <span className="text-slate-200">46%</span>
                <FooterSparkline
                  points={FOOTER_MEMORY_SPARK}
                  strokeClassName="text-slate-500/90"
                />
              </FooterSegment>

              <FooterSegment label="Network" className="min-w-[224px] 2xl:min-w-0">
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <span className="text-slate-300">88.3 Kbps</span>
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.7} />
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  12.4 Kbps
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.7} />
                </span>
              </FooterSegment>

              <FooterSegment className="min-w-[146px] justify-end 2xl:min-w-0">
                <span className="text-[0.9rem] font-normal tracking-[0.01em] text-slate-500">Status</span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#54d786]" />
                <span className="text-slate-300">Up to date</span>
              </FooterSegment>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
