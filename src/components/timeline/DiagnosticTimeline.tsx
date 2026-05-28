import { motion } from "framer-motion";
import type { DiagnosticNode, ScanProgress } from "@/core/types";
import { TimelineNode } from "./TimelineNode";
import { cn } from "@/utils/cn";

type DiagnosticTimelineProps = {
  nodes: DiagnosticNode[];
  selectedNodeId?: string;
  activeNodeId?: string;
  completedNodeIds: string[];
  scanProgress?: ScanProgress;
  onSelectNode: (nodeId: string) => void;
  isScanning: boolean;
};

function connectorTone(
  left: DiagnosticNode,
  right: DiagnosticNode,
  index: number,
  primaryFailedIndex: number
): string {
  if (primaryFailedIndex >= 0 && index >= primaryFailedIndex) {
    return "border-t border-dashed border-[#4b586f]/65 bg-transparent";
  }

  if (right.status === "failed" || left.status === "failed") {
    return "bg-[linear-gradient(90deg,#ff6b5e_0%,#ff6257_100%)] shadow-[0_0_14px_rgba(255,98,87,0.2)]";
  }

  if (left.status === "warning" || right.status === "warning") {
    return "bg-[linear-gradient(90deg,#f5bc48_0%,#f3c559_100%)] shadow-[0_0_10px_rgba(247,190,73,0.12)]";
  }

  if (left.status === "running" || right.status === "running") {
    return "bg-[linear-gradient(90deg,#3dcfff_0%,#54d786_52%,#54d786_100%)] timeline-connector-flow shadow-[0_0_12px_rgba(84,215,134,0.16)]";
  }

  if (left.status === "ok" && right.status === "ok") {
    return "bg-[linear-gradient(90deg,#58de8a_0%,#54d786_100%)] shadow-[0_0_12px_rgba(84,215,134,0.14)]";
  }

  return "border-t border-dashed border-[#4b586f]/65 bg-transparent";
}

export function DiagnosticTimeline({
  nodes,
  selectedNodeId,
  activeNodeId,
  completedNodeIds,
  scanProgress,
  onSelectNode,
  isScanning
}: DiagnosticTimelineProps) {
  const activeIndex = activeNodeId
    ? nodes.findIndex((node) => node.id === activeNodeId)
    : -1;
  const primaryFailedIndex = nodes.findIndex((node) => node.status === "failed");
  const completedNodeIdSet = new Set(completedNodeIds);

  return (
    <section className="app-panel min-w-0 rounded-[14px] px-4 py-4 sm:px-5 sm:py-5">
      <div className="relative overflow-x-auto overflow-y-hidden pb-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_50%_0%,rgba(77,134,223,0.06),transparent_38%)]" />

        <div className="relative min-w-[760px] xl:min-w-0">
          <div className="pointer-events-none absolute left-[5%] right-[5%] top-[4.72rem]">
            <div className="grid grid-cols-9 gap-0">
              {nodes.slice(0, -1).map((node, index) => {
                const rightNode = nodes[index + 1];
                const liveConnectorClass =
                  isScanning &&
                  (index < activeIndex ||
                    (completedNodeIdSet.has(node.id) && completedNodeIdSet.has(rightNode?.id ?? "")))
                    ? "bg-[linear-gradient(90deg,#31baf7_0%,#67e8f9_100%)] shadow-[0_0_12px_rgba(56,189,248,0.14)]"
                    : connectorTone(node, rightNode, index, primaryFailedIndex);

                return (
                  <motion.div
                    key={`${node.id}-${rightNode?.id}`}
                    className={cn(
                      "mx-0 h-[2px] origin-left rounded-full transition-[opacity] duration-300",
                      liveConnectorClass
                    )}
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{
                    scaleX:
                      isScanning && activeIndex >= 0
                        ? index < activeIndex
                          ? 1
                          : index === activeIndex
                            ? 0.58
                            : 0.14
                        : 1,
                    opacity:
                      isScanning && activeIndex >= 0
                        ? index <= activeIndex
                          ? 1
                          : 0.34
                        : 1
                  }}
                  transition={{ delay: index * 0.04, duration: 0.4, ease: "easeOut" }}
                />
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-10 gap-0.5 md:gap-1 xl:gap-0.5">
            {nodes.map((node, index) => (
              <TimelineNode
                key={node.id}
                node={node}
                index={index}
                selected={node.id === selectedNodeId}
                active={node.id === activeNodeId}
                liveComplete={completedNodeIdSet.has(node.id)}
                isPrimaryFailure={primaryFailedIndex === index}
                isDownstreamOfFailure={primaryFailedIndex >= 0 && index > primaryFailedIndex}
                isScanning={isScanning}
                onSelect={onSelectNode}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px] text-slate-400">
        <span className="text-slate-500">
          {isScanning
            ? scanProgress?.message ??
              "Aegis is moving through the connection chain live as each stage responds."
            : "Select any stage to inspect the evidence behind it."}
        </span>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#54d786] shadow-[0_0_10px_rgba(84,215,134,0.2)]" />
            Passed
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6257] shadow-[0_0_10px_rgba(255,98,87,0.2)]" />
            Issue
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#465369]" />
            Pending
          </span>
        </div>
      </div>
    </section>
  );
}
