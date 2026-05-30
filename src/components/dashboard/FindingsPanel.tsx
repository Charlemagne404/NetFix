import { ChevronRight } from "lucide-react";
import type { DiagnosticNode, DiagnosticStatus } from "@/core/types";
import { StatusGlyph } from "@/components/common/IconMap";
import { cn } from "@/utils/cn";

type FindingsPanelProps = {
  nodes: DiagnosticNode[];
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
  onViewDetails: () => void;
};

function isFindingStatus(status: DiagnosticStatus) {
  return status === "failed" || status === "warning" || status === "unknown" || status === "skipped";
}

function getFindingRows(nodes: DiagnosticNode[]) {
  const findings = nodes.filter((node) => isFindingStatus(node.status));
  if (!findings.length) {
    return nodes.slice(0, 4);
  }

  const supporting = nodes.filter(
    (node) => !findings.some((finding) => finding.id === node.id) && node.status === "ok"
  );

  return [...findings, ...supporting].slice(0, 4);
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
  if (status === "failed") return "bg-[#ff6a5a]/[0.06]";
  if (status === "warning") return "bg-[#f7be49]/[0.06]";
  if (status === "ok") return "bg-[#54d786]/[0.05]";
  return "bg-[rgba(118,146,188,0.04)]";
}

export function FindingsPanel({
  nodes,
  selectedNodeId,
  onSelectNode,
  onViewDetails
}: FindingsPanelProps) {
  const rows = getFindingRows(nodes);
  const selectedNode = rows.find((node) => node.id === selectedNodeId) ?? rows[0] ?? nodes[0];

  return (
    <section className="app-panel min-w-0 flex h-full min-h-0 flex-col rounded-[14px]">
      <div className="border-b border-[color:var(--aegis-line-soft)] px-6 py-3.5">
        <h2 className="text-[1.02rem] font-semibold tracking-[0.01em] text-white">What we found</h2>
        <p className="mt-1 text-[0.92rem] leading-6 text-slate-400">
          Aegis highlights the symptoms with the clearest evidence first.
        </p>
      </div>

      <div className="min-h-0 flex-1 px-4 py-3 sm:px-5">
        <div className="overflow-hidden rounded-[14px] border border-[color:var(--aegis-line-soft)] bg-[linear-gradient(180deg,rgba(15,24,36,0.88)_0%,rgba(11,20,31,0.94)_100%)] shadow-[inset_0_1px_0_rgba(170,192,224,0.02)]">
          {rows.map((node, index) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode(node.id)}
              className={cn(
                "flex w-full items-start gap-3.5 px-4 py-2.5 text-left transition sm:px-5",
                index !== rows.length - 1 && "border-b border-[color:var(--aegis-line-soft)]",
                node.id === selectedNode?.id
                  ? `${rowTone(node.status)} shadow-[inset_0_0_0_1px_rgba(120,154,206,0.08)]`
                  : "hover:bg-[rgba(118,146,188,0.04)]"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current/30 bg-black/10",
                  statusTone(node.status)
                )}
              >
                <StatusGlyph status={node.status} className="h-3.5 w-3.5" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1.01rem] font-medium tracking-[0.01em] text-white">
                      {node.summary}
                    </span>
                    <span className="mt-1 block max-w-[36rem] truncate text-[0.9rem] leading-5 text-slate-400">
                      {compactDetail(node.explanation)}
                    </span>
                  </span>

                  <span className="hidden shrink-0 items-center gap-3 pl-3 sm:flex">
                    <span className={cn("text-[0.98rem] font-medium", statusTone(node.status))}>
                      {getFindingValue(node)}
                    </span>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition",
                        node.id === selectedNode?.id ? "text-slate-300" : "text-slate-500"
                      )}
                    />
                  </span>
                </span>
              </span>

              <ChevronRight
                className={cn(
                  "mt-1 h-4 w-4 shrink-0 transition sm:hidden",
                  node.id === selectedNode?.id ? "text-slate-300" : "text-slate-500"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {selectedNode ? (
        <div className="border-t border-[color:var(--aegis-line-soft)] px-6 py-2">
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#4b8dff] transition hover:text-[#78aaff]"
          >
            View full details
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
