import type { EnvironmentInfo, MockScenarioId } from "@/core/types";
import { X } from "lucide-react";
import { ScenarioSwitcher } from "@/components/settings/ScenarioSwitcher";

type SettingsPanelProps = {
  open: boolean;
  demoMode: boolean;
  environmentInfo: EnvironmentInfo;
  rawOutput: boolean;
  scenarioId: MockScenarioId;
  onDemoModeChange: (value: boolean) => void;
  onRawOutputChange: (value: boolean) => void;
  onScenarioChange: (scenario: MockScenarioId) => void;
  onClose: () => void;
};

export function SettingsPanel({
  open,
  demoMode,
  environmentInfo,
  rawOutput,
  scenarioId,
  onDemoModeChange,
  onRawOutputChange,
  onScenarioChange,
  onClose
}: SettingsPanelProps) {
  if (!open) return null;

  const runtimeLabel = demoMode
    ? "Diagnostic lab"
    : environmentInfo.isWindows && environmentInfo.isTauri && environmentInfo.isAdmin
      ? "Live Windows runtime"
      : environmentInfo.isWindows && environmentInfo.isTauri
        ? "Desktop runtime needs elevation"
        : "Preview workspace";
  const runtimeDescription = demoMode
    ? "Replay known failure cases and simulated repairs without touching the current device."
    : environmentInfo.isWindows && environmentInfo.isTauri && environmentInfo.isAdmin
      ? "Allowlisted scans and repair actions are available in this desktop session."
      : environmentInfo.isWindows && environmentInfo.isTauri
        ? "The desktop runtime is present, but Aegis is not elevated. Live fixes may be blocked until Windows launches it with administrator access."
        : "Aegis stays explorable here with local preview data until the Windows Tauri runtime is available.";

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/72 p-4 backdrop-blur-xl">
      <aside className="w-full max-w-2xl rounded-3xl border border-white/12 bg-[#0c1424] p-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-white">Settings</h3>
            <p className="mt-1 text-sm text-slate-400">
              Safety-first defaults. Live repair commands only run inside the Windows desktop app.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="font-semibold text-white">Workspace</p>
            <p className="mt-1 text-sm text-slate-300">{runtimeLabel}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{runtimeDescription}</p>
          </div>

          <label className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <span>
              <span className="block font-semibold text-white">Show raw command output</span>
              <span className="mt-1 block text-sm leading-6 text-slate-400">
                Technician mode exposes raw output, IPs, routes, and adapter details.
              </span>
            </span>
            <input
              type="checkbox"
              checked={rawOutput}
              onChange={(event) => onRawOutputChange(event.target.checked)}
              className="mt-1 h-5 w-5 accent-cyan-300"
            />
          </label>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="font-semibold text-white">Repair confirmations</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Always enabled. Moderate fixes require confirmation. Aggressive fixes require typed confirmation and are never recommended automatically.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
            <p className="font-semibold text-amber-100">Privacy</p>
            <p className="mt-1 text-sm leading-6 text-amber-100/80">
              Aegis collects no telemetry, uploads no reports, and never extracts saved Wi-Fi passwords. Exported reports remain local.
            </p>
          </div>

          <details
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
            open={demoMode}
          >
            <summary className="cursor-pointer list-none font-semibold text-white">
              Simulation tools
            </summary>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Hidden away by default. Use this only to replay known failure cases, validate UX copy, or demonstrate repair flows without touching a real machine.
            </p>

            <label className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/10 p-4">
              <span>
                <span className="block font-semibold text-white">Diagnostic lab</span>
                <span className="mt-1 block text-sm leading-6 text-slate-400">
                  Unlock replay cases and simulated repair outcomes for product development and internal demos.
                </span>
              </span>
              <input
                type="checkbox"
                checked={demoMode}
                onChange={(event) => onDemoModeChange(event.target.checked)}
                className="mt-1 h-5 w-5 accent-cyan-300"
              />
            </label>

            {demoMode ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                <ScenarioSwitcher value={scenarioId} onChange={onScenarioChange} />
              </div>
            ) : null}
          </details>
        </div>
      </aside>
    </div>
  );
}
