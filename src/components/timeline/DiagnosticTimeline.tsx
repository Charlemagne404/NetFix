import { motion } from "framer-motion";
import type { DiagnosticNode } from "@/core/types";
import { TimelineNode } from "./TimelineNode";
import { cn } from "@/utils/cn";

type DiagnosticTimelineProps = {
  nodes: DiagnosticNode[];
  selectedNodeId?: string;
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
  onSelectNode,
  isScanning
}: DiagnosticTimelineProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-panel backdrop-blur-2xl">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Diagnostic timeline
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Signal path from device state to app-layer connectivity.
          </p>
        </div>
        <div className="text-sm text-slate-400">
          {isScanning ? "Replay running left to right" : "Click any node for evidence"}
        </div>
      </div>

      <div className="relative">
        <div className="hidden lg:absolute lg:left-10 lg:right-10 lg:top-[4.1rem] lg:block">
          <div className="grid grid-cols-9 gap-2">
            {nodes.slice(0, -1).map((node, index) => (
              <motion.div
                key={`${node.id}-${nodes[index + 1]?.id}`}
                className={cn(
                  "h-[3px] rounded-full bg-gradient-to-r",
                  connectorTone(node, nodes[index + 1])
                )}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: index * 0.04, duration: 0.38, ease: "easeOut" }}
                style={{ transformOrigin: "left" }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-10">
          {nodes.map((node, index) => (
            <TimelineNode
              key={node.id}
              node={node}
              index={index}
              selected={node.id === selectedNodeId}
              onSelect={onSelectNode}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
