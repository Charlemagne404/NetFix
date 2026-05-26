import { motion } from "framer-motion";
import type { DiagnosticNode } from "@/core/types";
import { TimelineNode } from "./TimelineNode";
import { cn } from "@/utils/cn";

type DiagnosticTimelineProps = {
  nodes: DiagnosticNode[];
  selectedNodeId?: string;
  activeNodeId?: string;
  onSelectNode: (nodeId: string) => void;
  isScanning: boolean;
};

function connectorTone(left: DiagnosticNode, right: DiagnosticNode): string {
  if (left.status === "failed" || right.status === "failed") {
    return "from-rose-300/60 via-rose-300/30 to-slate-500/20";
  }
  if (left.status === "warning" || right.status === "warning") {
    return "from-amber-300/55 via-amber-300/25 to-slate-500/20";
  }
  if (left.status === "running" || right.status === "running") {
    return "from-cyan-300/70 via-cyan-300/30 to-slate-500/20";
  }
  if (left.status === "ok" && right.status === "ok") {
    return "from-emerald-300/60 via-cyan-300/35 to-cyan-300/20";
  }
  return "from-slate-500/20 via-slate-500/10 to-slate-500/10";
}

export function DiagnosticTimeline({
  nodes,
  selectedNodeId,
  activeNodeId,
  onSelectNode,
  isScanning
}: DiagnosticTimelineProps) {
  const activeIndex = activeNodeId
    ? nodes.findIndex((node) => node.id === activeNodeId)
    : -1;
  const primaryFailedIndex = nodes.findIndex((node) => node.status === "failed");

  return (
    <section className="app-panel min-w-0 rounded-[14px] px-6 py-5">
      <div className="relative overflow-x-auto overflow-y-hidden pb-2">
        <div className="absolute left-[4.1rem] right-[4.1rem] top-[3.9rem] hidden xl:block">
          <div className="grid grid-cols-9 gap-0">
            {nodes.slice(0, -1).map((node, index) => (
              <motion.div
                key={`${node.id}-${nodes[index + 1]?.id}`}
                className={cn(
                  "h-[2px] rounded-full border-t border-dashed border-transparent bg-gradient-to-r transition-[opacity] duration-300",
                  (activeIndex === index || activeIndex === index + 1) &&
                    isScanning &&
                    "timeline-connector-flow",
                  connectorTone(node, nodes[index + 1])
                )}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{
                  scaleX:
                    isScanning && activeIndex >= 0
                      ? index < activeIndex
                        ? 1
                        : index === activeIndex
                          ? 0.68
                          : 0.16
                      : 1,
                  opacity:
                    isScanning && activeIndex >= 0
                      ? index <= activeIndex
                        ? 1
                        : 0.28
                      : 1
                }}
                transition={{ delay: index * 0.04, duration: 0.42, ease: "easeOut" }}
                style={{ transformOrigin: "left" }}
              />
            ))}
          </div>
        </div>

        <div className="grid min-w-[940px] grid-cols-10 gap-1 xl:min-w-[1020px] 2xl:min-w-[1120px]">
          {nodes.map((node, index) => (
            <TimelineNode
              key={node.id}
              node={node}
              index={index}
              selected={node.id === selectedNodeId}
              active={node.id === activeNodeId}
              isPrimaryFailure={primaryFailedIndex === index}
              isDownstreamOfFailure={primaryFailedIndex >= 0 && index > primaryFailedIndex}
              isScanning={isScanning}
              onSelect={onSelectNode}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-6 text-sm text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#54d786]" />
          Passed
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff6257]" />
          Issue
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#445066]" />
          Pending
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.45)]" />
          Running
        </span>
        <span className="text-slate-500">
          {isScanning
            ? "Replay transitions each stage from queued to active to resolved"
            : "Select a stage for evidence"}
        </span>
      </div>
    </section>
  );
}
