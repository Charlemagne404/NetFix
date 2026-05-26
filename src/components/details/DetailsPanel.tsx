import { useState } from "react";
import { CheckCircle2, ListChecks, Wrench } from "lucide-react";
import type { AppMode, DiagnosticNode, FixAction } from "@/core/types";
import { StatusPill } from "@/components/common/StatusPill";
import { FixActionCard } from "@/components/fixes/FixActionCard";
import { cn } from "@/utils/cn";
import { EvidenceList } from "./EvidenceList";
import { TechnicianDetails } from "./TechnicianDetails";

type DetailsPanelProps = {
  node: DiagnosticNode;
  mode: AppMode;
  onRunFix: (fix: FixAction) => void;
};

type DetailTab = "overview" | "evidence" | "fixes" | "technician";

const tabs: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "fixes", label: "Fixes" },
  { id: "technician", label: "Technician Details" }
];

export function DetailsPanel({ node, mode, onRunFix }: DetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-panel backdrop-blur-2xl">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-white">{node.label}</h2>
            <StatusPill status={node.status} />
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {node.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-full px-3 py-2 text-xs font-semibold transition",
                activeTab === tab.id
                  ? "bg-white text-slate-950"
                  : "border border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.07]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {activeTab === "overview" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
              <div className="mb-3 flex items-center gap-2 text-cyan-100">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-semibold text-white">What happened</h3>
              </div>
              <p className="text-sm leading-7 text-slate-300">{node.explanation}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
              <div className="mb-3 flex items-center gap-2 text-cyan-100">
                <ListChecks className="h-5 w-5" />
                <h3 className="font-semibold text-white">What was checked</h3>
              </div>
              <ul className="space-y-2">
                {node.checks.map((check) => (
                  <li key={check} className="flex gap-2 text-sm text-slate-300">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/80" />
                    {check}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 lg:col-span-2">
              <h3 className="font-semibold text-white">Likely causes</h3>
              {node.likelyCauses.length ? (
                <ul className="mt-3 grid gap-2 md:grid-cols-2">
                  {node.likelyCauses.map((cause) => (
                    <li key={cause} className="rounded-xl bg-white/[0.035] px-3 py-2 text-sm text-slate-300">
                      {cause}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-400">
                  No likely failure cause was detected at this stage.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "evidence" ? <EvidenceList evidence={node.evidence} /> : null}

        {activeTab === "fixes" ? (
          <div className="space-y-3">
            {node.recommendedFixes.length ? (
              node.recommendedFixes.map((fix) => (
                <FixActionCard key={fix.id} fix={fix} onRun={onRunFix} />
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
                <div className="flex items-center gap-2 text-cyan-100">
                  <Wrench className="h-5 w-5" />
                  <h3 className="font-semibold text-white">No node-specific fix</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  This node does not currently require a repair action. If the overall diagnosis recommends a fix, it appears in the status card.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "technician" ? (
          mode === "technician" ? (
            <TechnicianDetails node={node} />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
              <h3 className="font-semibold text-white">Technician mode is off</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Switch to Technician mode to inspect raw outputs, exact labels, and detailed evidence. Normal mode keeps the explanation focused on what matters.
              </p>
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
