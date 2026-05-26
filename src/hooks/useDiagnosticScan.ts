import { useCallback, useRef, useState } from "react";
import { runDiagnosticEngine } from "@/core/diagnosticEngine";
import type { DiagnosticNode, MockScenarioId, ScanResult } from "@/core/types";
import type { PlatformAdapter } from "@/platform/platformAdapter";

type UseDiagnosticScanInput = {
  adapter: PlatformAdapter;
  initialScan: ScanResult;
  onScanComplete?: (scan: ScanResult) => void;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const REPLAY_PREP_MS = 120;
const REPLAY_RUNNING_MS = 320;
const REPLAY_SETTLE_MS = 170;
const REPLAY_FAILURE_HOLD_MS = 360;

function buildPendingNodes(nodes: DiagnosticNode[]): DiagnosticNode[] {
  return nodes.map((node) => ({
    ...node,
    status: "pending",
    severity: "info",
    summary: "Queued for scan..."
  }));
}

function buildReplayNodes(
  nodes: DiagnosticNode[],
  activeIndex: number | null,
  settledIndex: number
): DiagnosticNode[] {
  return nodes.map((node, index) => {
    if (index <= settledIndex) return node;
    if (index === activeIndex) {
      return {
        ...node,
        status: "running",
        severity: "info",
        summary: `Checking ${node.label.toLowerCase()}...`
      };
    }
    return {
      ...node,
      status: "pending",
      severity: "info",
      summary: "Waiting for earlier checks..."
    };
  });
}

export function useDiagnosticScan({
  adapter,
  initialScan,
  onScanComplete
}: UseDiagnosticScanInput) {
  const [scanResult, setScanResult] = useState(initialScan);
  const [displayNodes, setDisplayNodes] = useState(initialScan.nodes);
  const [isScanning, setIsScanning] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | undefined>();
  const runIdRef = useRef(0);

  const isStaleRun = (runId: number) => runIdRef.current !== runId;

  const runScan = useCallback(
    async (scenarioId?: MockScenarioId) => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      setIsScanning(true);
      setDisplayNodes(buildPendingNodes(scanResult.nodes));
      setActiveNodeId(scanResult.nodes[0]?.id);

      const finalScan = await runDiagnosticEngine(adapter, scenarioId);
      if (isStaleRun(runId)) return;

      setDisplayNodes(buildPendingNodes(finalScan.nodes));
      setActiveNodeId(finalScan.nodes[0]?.id);
      await wait(REPLAY_PREP_MS);

      for (let index = 0; index < finalScan.nodes.length; index += 1) {
        if (isStaleRun(runId)) return;
        setActiveNodeId(finalScan.nodes[index]?.id);
        setDisplayNodes(buildReplayNodes(finalScan.nodes, index, index - 1));
        await wait(REPLAY_RUNNING_MS);
        if (isStaleRun(runId)) return;
        setDisplayNodes(buildReplayNodes(finalScan.nodes, null, index));
        await wait(
          finalScan.nodes[index]?.status === "failed"
            ? REPLAY_FAILURE_HOLD_MS
            : REPLAY_SETTLE_MS
        );
      }

      if (isStaleRun(runId)) return;
      setScanResult(finalScan);
      setDisplayNodes(finalScan.nodes);
      setActiveNodeId(undefined);
      setIsScanning(false);
      onScanComplete?.(finalScan);
    },
    [adapter, onScanComplete]
  );

  return {
    scanResult,
    displayNodes,
    isScanning,
    activeNodeId,
    runScan
  };
}
