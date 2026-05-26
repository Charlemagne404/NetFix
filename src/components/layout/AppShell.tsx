import { Download, RotateCw, Settings, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { AppMode, MockScenarioId, ThemeMode } from "@/core/types";
import { ModeToggle } from "@/components/settings/ModeToggle";
import { ScenarioSwitcher } from "@/components/settings/ScenarioSwitcher";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { cn } from "@/utils/cn";

type AppShellProps = {
  children: ReactNode;
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

export function AppShell({
  children,
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
  return (
    <div
      className={cn(
        "min-h-screen overflow-x-hidden bg-aegis-radial text-slate-100 antialiased"
      )}
    >
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-[-10%] top-24 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-[-8%] top-8 h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-[-16%] left-1/3 h-[24rem] w-[24rem] rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.045] p-4 shadow-panel backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100 shadow-glow">
              <ShieldCheck className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Aegis Network Doctor
              </h1>
              <p className="text-sm text-slate-400">
                Visual network diagnostics for Windows
              </p>
            </div>
            {demoMode ? (
              <span className="hidden rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100 sm:inline-flex">
                Demo mode
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ScenarioSwitcher value={scenarioId} onChange={onScenarioChange} />
              <ModeToggle mode={mode} onChange={onModeChange} />
              <ThemeToggle theme={theme} onChange={onThemeChange} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRunScan}
                disabled={isScanning}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_34px_rgba(56,213,255,.28)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCw className={cn("h-4 w-4", isScanning && "animate-spin")} />
                {isScanning ? "Scanning" : "Run Scan"}
              </button>
              <button
                type="button"
                onClick={onExportReport}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:bg-white/[0.07]"
              >
                <Download className="h-4 w-4" />
                Export Report
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:bg-white/[0.07]"
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
