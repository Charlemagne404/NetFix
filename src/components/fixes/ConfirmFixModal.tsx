import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { FixAction, FixConfirmation } from "@/core/types";
import { SafetyPill } from "@/components/common/SafetyPill";
import {
  AGGRESSIVE_CONFIRMATION_PHRASE,
  buildFixConfirmation,
  requiresExplicitConfirmation,
  requiresTypedConfirmation
} from "@/core/fixRegistry";

type ConfirmFixModalProps = {
  fix: FixAction | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (fix: FixAction, confirmation?: FixConfirmation) => void;
};

export function ConfirmFixModal({
  fix,
  busy,
  onCancel,
  onConfirm
}: ConfirmFixModalProps) {
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    setConfirmation("");
    setAcknowledged(false);
  }, [fix?.id]);

  if (!fix) return null;

  const needsExplicitConfirmation = requiresExplicitConfirmation(fix.safety);
  const requiresResetText = requiresTypedConfirmation(fix.safety);
  const canConfirm =
    !busy &&
    (!needsExplicitConfirmation || acknowledged) &&
    (!requiresResetText || confirmation === AGGRESSIVE_CONFIRMATION_PHRASE);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/72 p-4 backdrop-blur-xl">
      <div className="w-full max-w-2xl rounded-3xl border border-white/12 bg-[#0c1424] p-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-100">
              <AlertTriangle className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold tracking-tight text-white">
                  Confirm repair action
                </h3>
                <SafetyPill safety={fix.safety} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Aegis will only run this allowlisted action after showing the exact command preview.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <h4 className="font-semibold text-white">{fix.title}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-300">{fix.description}</p>
          <p className="mt-2 text-sm text-slate-400">{fix.estimatedImpact}</p>
          {fix.warning ? (
            <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
              {fix.warning}
            </p>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Command preview
          </p>
          <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-cyan-50/80">
            {fix.commandsPreview?.join("\n") ?? "No command preview available."}
          </pre>
        </div>

        {needsExplicitConfirmation ? (
          <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-cyan-300"
            />
            <span className="leading-6">
              I reviewed the command preview and understand the impact of this
              {fix.safety === "aggressive" ? " last-resort" : ""} action.
            </span>
          </label>
        ) : null}

        {requiresResetText ? (
          <label className="mt-4 block text-sm text-slate-300">
            Type {AGGRESSIVE_CONFIRMATION_PHRASE} to unlock this aggressive action.
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-rose-300/50 focus:ring-2 focus:ring-rose-300/20"
              placeholder={AGGRESSIVE_CONFIRMATION_PHRASE}
            />
          </label>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm(fix, buildFixConfirmation(fix.safety, confirmation))
            }
            disabled={!canConfirm}
            className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Running" : "Run allowlisted fix"}
          </button>
        </div>
      </div>
    </div>
  );
}
