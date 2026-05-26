import { motion } from "framer-motion";
import type { DiagnosticNode as DiagnosticNodeType } from "@/core/types";
import { StatusGlyph, TimelineIcon } from "@/components/common/IconMap";
import { cn } from "@/utils/cn";

type TimelineNodeProps = {
  node: DiagnosticNodeType;
  index: number;
  selected: boolean;
  active: boolean;
  isPrimaryFailure: boolean;
  isDownstreamOfFailure: boolean;
  isScanning: boolean;
  onSelect: (id: string) => void;
};

function nodeTone(status: DiagnosticNodeType["status"]): string {
  if (status === "ok") return "border-[#54d786]/55 text-[#54d786]";
  if (status === "failed") return "border-[#ff6257]/55 text-[#ff6257]";
  if (status === "warning") return "border-[#f7be49]/55 text-[#f7be49]";
  if (status === "running") return "border-cyan-300/50 text-cyan-100";
  return "border-[color:var(--aegis-line)] text-slate-500";
}

function getTimelineValue(node: DiagnosticNodeType) {
  if (node.id === "ip" || node.id === "gateway" || node.id === "dns") {
    return node.evidence[0]?.value ?? "—";
  }

  if (node.id === "internet" || node.id === "windows" || node.id === "apps") {
    return node.status === "ok" ? "Reachable" : "—";
  }

  return "";
}

export function TimelineNode({
  node,
  index,
  selected,
  active,
  isPrimaryFailure,
  isDownstreamOfFailure,
  isScanning,
  onSelect
}: TimelineNodeProps) {
  const value = getTimelineValue(node);
  const isFailed = node.status === "failed";
  const shouldDim = isDownstreamOfFailure && !selected && !active;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(node.id)}
      className={cn(
        "group relative isolate flex min-h-[9rem] flex-col items-center px-1 text-center outline-none transition",
        selected
          ? "rounded-[12px] bg-[rgba(118,146,188,0.05)]"
          : "hover:rounded-[12px] hover:bg-[rgba(118,146,188,0.04)]"
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: shouldDim ? 0.52 : node.status === "pending" ? 0.72 : 1,
        y: active ? -2 : 0,
        scale: selected ? 1.008 : 1
      }}
      transition={{ delay: index * 0.035, duration: 0.32, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      aria-pressed={selected}
      aria-label={`${node.label}: ${node.summary}`}
    >
      <div className="relative">
        <span
          className={cn(
            "pointer-events-none absolute inset-[-13px] rounded-full opacity-0 blur-xl transition duration-300",
            active &&
              node.status === "running" &&
              "timeline-scan-halo opacity-100",
            isFailed &&
              isPrimaryFailure &&
              "timeline-failure-halo opacity-100"
          )}
        />

        <span
          className={cn(
            "pointer-events-none absolute inset-[-6px] rounded-full opacity-0 transition duration-300",
            active &&
              node.status === "running" &&
              "timeline-running-ring opacity-100",
            isFailed &&
              isPrimaryFailure &&
              "timeline-failure-ring opacity-100"
          )}
        />

        <motion.div
          className={cn(
            "relative grid h-11 w-11 place-items-center rounded-full border bg-transparent transition-[border-color,color,background-color,box-shadow] duration-300",
            nodeTone(node.status)
          )}
          animate={{
            scale:
              active && node.status === "running"
                ? 1.07
                : isFailed && isPrimaryFailure
                  ? 1.04
                  : 1,
            boxShadow:
              active && node.status === "running"
                ? "0 0 0 1px rgba(103,232,249,.20), 0 0 28px rgba(56,189,248,.22)"
                : isFailed && isPrimaryFailure
                  ? "0 0 0 1px rgba(255,98,87,.28), 0 0 38px rgba(255,98,87,.24)"
                  : selected
                    ? "0 0 0 1px rgba(113,139,179,.18)"
                  : "0 0 0 0 rgba(0,0,0,0)"
          }}
          transition={{ duration: 0.34, ease: "easeOut" }}
        >
          <TimelineIcon
            name={node.icon}
            className={cn(
              "flex h-5 w-5 items-center justify-center text-[0.68rem] font-semibold tracking-[0.02em] text-slate-100",
              node.id === "dns" && "text-[0.58rem]",
              (node.icon === "badge-check" || node.icon === "app-window") && "text-slate-100"
            )}
          />
        </motion.div>
      </div>

      <motion.span
        className={cn(
          "absolute top-[2.55rem] grid h-7 w-7 place-items-center rounded-full border bg-[rgba(13,22,34,0.96)]",
          nodeTone(node.status)
        )}
        animate={{
          scale: active ? 1.08 : isFailed && isPrimaryFailure ? 1.1 : 1,
          y: isScanning && active ? -1 : 0
        }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <span className="grid h-5.5 w-5.5 place-items-center rounded-full border border-current/25 bg-[rgba(13,22,34,0.96)] text-current">
          <StatusGlyph status={node.status} className="h-3.5 w-3.5" />
        </span>
      </motion.span>

      <div className="mt-[1.95rem]">
        <p
          className={cn(
            "text-[0.95rem] font-medium tracking-[0.01em] text-white transition-colors duration-300",
            isFailed && isPrimaryFailure && "text-[#fff1ee]"
          )}
        >
          {node.label}
        </p>
        <p
          className={cn(
            "mt-1.5 min-h-5 text-[0.88rem] transition-colors duration-300",
            isFailed && isPrimaryFailure ? "text-[#ffc8c2]" : "text-slate-300"
          )}
        >
          {value || "\u00a0"}
        </p>
      </div>
    </motion.button>
  );
}
