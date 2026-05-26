import { motion } from "framer-motion";
import type { DiagnosticNode as DiagnosticNodeType } from "@/core/types";
import { StatusGlyph, TimelineIcon } from "@/components/common/IconMap";
import { StatusPill } from "@/components/common/StatusPill";
import { cn } from "@/utils/cn";
import { statusGlow } from "@/utils/status";

type TimelineNodeProps = {
  node: DiagnosticNodeType;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
};

function nodeTone(status: DiagnosticNodeType["status"]): string {
  if (status === "ok") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (status === "failed") return "border-rose-300/50 bg-rose-400/15 text-rose-100";
  if (status === "warning") return "border-amber-300/40 bg-amber-300/12 text-amber-100";
  if (status === "running") return "border-cyan-300/50 bg-cyan-300/15 text-cyan-100";
  return "border-slate-300/15 bg-slate-300/5 text-slate-300";
}

export function TimelineNode({ node, index, selected, onSelect }: TimelineNodeProps) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(node.id)}
      className={cn(
        "group relative flex min-w-[8.6rem] flex-1 flex-col items-center gap-3 rounded-3xl border p-3 text-center outline-none transition",
        selected
          ? "border-cyan-200/45 bg-cyan-200/[0.08] shadow-[0_0_42px_rgba(56,213,255,.18)]"
          : "border-white/10 bg-white/[0.035] hover:border-cyan-300/25 hover:bg-white/[0.06]"
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035, duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      aria-pressed={selected}
      aria-label={`${node.label}: ${node.summary}`}
    >
      <div
        className={cn(
          "relative grid h-14 w-14 place-items-center rounded-2xl border transition",
          nodeTone(node.status),
          statusGlow[node.status],
          node.status === "running" && "animate-pulse",
          node.status === "failed" && "after:absolute after:inset-[-7px] after:rounded-[1.35rem] after:border after:border-rose-300/25 after:content-['']"
        )}
      >
        <TimelineIcon name={node.icon} className="h-6 w-6" />
        <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-slate-950/80 bg-slate-950 text-current">
          <StatusGlyph status={node.status} className="h-3.5 w-3.5" />
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold tracking-tight text-white">{node.label}</p>
        <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-4 text-slate-400">
          {node.summary}
        </p>
      </div>
      <StatusPill status={node.status} />
    </motion.button>
  );
}
