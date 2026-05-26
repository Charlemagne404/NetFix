import { ChevronRight, Eye, TerminalSquare } from "lucide-react";
import type { AppMode, DiagnosticNode, DiagnosticStatus, ScanResult } from "@/core/types";
import { StatusGlyph } from "@/components/common/IconMap";
import { cn } from "@/utils/cn";

type FindingsPanelProps = {
  scan: ScanResult;
  selectedNodeId?: string;
  mode: AppMode;
  onSelectNode: (nodeId: string) => void;
  onViewReport: () => void;
  onOpenTechnician: () => void;
};

function isFindingStatus(status: DiagnosticStatus) {
  return status === "failed" || status === "warning" || status === "unknown" || status === "skipped";
}

function getFindingRows(nodes: DiagnosticNode[]) {
  const findings = nodes.filter((node) => isFindingStatus(node.status));
  if (!findings.length) {
    return nodes.slice(0, 5);
  }

  const supporting = nodes.filter(
    (node) => !findings.some((finding) => finding.id === node.id) && node.status === "ok"
  );

  return [...findings, ...supporting].slice(0, 5);
}

function getFindingValue(node: DiagnosticNode) {
  const primaryEvidence =
    node.evidence.find((item) => item.status === "failed" || item.status === "warning") ??
    node.evidence[0];

  return primaryEvidence?.value ?? "Observed";
}

function compactDetail(text: string) {
  const [firstSentence] = text.split(". ");
  return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
}

function statusTone(status: DiagnosticStatus) {
  if (status === "failed") return "text-[#ff6a5a]";
  if (status === "warning") return "text-[#f7be49]";
  if (status === "ok") return "text-[#54d786]";
  return "text-slate-400";
}

function rowTone(status: DiagnosticStatus) {
  if (status === "failed") return "border-[#ff6a5a]/25 bg-[#ff6a5a]/[0.04]";
  if (status === "warning") return "border-[#f7be49]/25 bg-[#f7be49]/[0.04]";
  if (status === "ok") return "border-[#54d786]/25 bg-[#54d786]/[0.04]";
  return "border-[color:var(--aegis-line-soft)] bg-[rgba(118,146,188,0.04)]";
}

export function FindingsPanel({
  scan,
  selectedNodeId,
  mode,
  onSelectNode,
  onViewReport,
  onOpenTechnician
}: FindingsPanelProps) {
  const rows = getFindingRows(scan.nodes);
  const selectedNode = rows.find((node) => node.id === selectedNodeId) ?? rows[0] ?? scan.nodes[0];

  return (
    <section className="app-panel min-w-0 flex h-[360px] flex-col rounded-[14px]">
      <div className="border-b border-[color:var(--aegis-line-soft)] px-6 py-4">
        <h2 className="text-[1.05rem] font-semibold tracking-[0.01em] text-white">What we found</h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Aegis highlights the symptoms with the clearest evidence first.
        </p>
      </div>

      <div className="hide-scrollbar min-h-0 flex-1 overflow-auto px-4 py-3">
        {rows.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelectNode(node.id)}
            className={cn(
              "flex w-full items-start gap-4 rounded-[12px] border px-4 py-3 text-left transition",
              node.id === selectedNode?.id
                ? `${rowTone(node.status)} shadow-[0_0_0_1px_rgba(56,213,255,0.06)]`
                : "border-transparent hover:border-[color:var(--aegis-line-soft)] hover:bg-[rgba(118,146,188,0.04)]"
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current/30 bg-black/15",
                statusTone(node.status)
              )}
            >
              <StatusGlyph status={node.status} className="h-3.5 w-3.5" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-4">
                <span className="min-w-0">
                  <span className="block truncate text-[1.02rem] font-medium tracking-[0.01em] text-white">
                    {node.summary}
                  </span>
                  <span className="mt-1 block max-w-[34rem] text-sm leading-6 text-slate-400">
                    {compactDetail(node.explanation)}
                  </span>
                </span>
                <span
                  className={cn(
                    "hidden shrink-0 text-sm font-medium sm:inline",
                    statusTone(node.status)
                  )}
                >
                  {getFindingValue(node)}
                </span>
              </span>
            </span>

            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
          </button>
        ))}
      </div>

      {selectedNode ? (
        <div className="border-t border-[color:var(--aegis-line-soft)] px-6 py-4">
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={onViewReport}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#4b8dff] transition hover:text-[#78aaff]"
            >
              <Eye className="h-4 w-4" />
              View full details
            </button>

            {mode !== "technician" ? (
              <button
                type="button"
                onClick={onOpenTechnician}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
              >
                <TerminalSquare className="h-4 w-4" />
                Technician details
              </button>
            ) : (
              <p className="inline-flex items-center gap-2 text-sm text-slate-400">
                <TerminalSquare className="h-4 w-4" />
                Technician mode is enabled
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
