import { X } from "lucide-react";

type SettingsPanelProps = {
  open: boolean;
  demoMode: boolean;
  rawOutput: boolean;
  onDemoModeChange: (value: boolean) => void;
  onRawOutputChange: (value: boolean) => void;
  onClose: () => void;
};

export function SettingsPanel({
  open,
  demoMode,
  rawOutput,
  onDemoModeChange,
  onRawOutputChange,
  onClose
}: SettingsPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/72 p-4 backdrop-blur-xl">
      <aside className="w-full max-w-2xl rounded-3xl border border-white/12 bg-[#0c1424] p-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-white">Settings</h3>
            <p className="mt-1 text-sm text-slate-400">
              Safety-first defaults. Real commands are only available in the Windows Tauri app.
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
          <label className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <span>
              <span className="block font-semibold text-white">Demo mode</span>
              <span className="mt-1 block text-sm leading-6 text-slate-400">
                Use realistic local mock scenarios. Automatically used outside Windows/Tauri.
              </span>
            </span>
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(event) => onDemoModeChange(event.target.checked)}
              className="mt-1 h-5 w-5 accent-cyan-300"
            />
          </label>

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
        </div>
      </aside>
    </div>
  );
}
