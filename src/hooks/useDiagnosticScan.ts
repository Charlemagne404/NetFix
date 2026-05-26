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

function buildReplayNodes(nodes: DiagnosticNode[], activeIndex: number): DiagnosticNode[] {
  return nodes.map((node, index) => {
    if (index < activeIndex) return node;
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

  const runScan = useCallback(
    async (scenarioId?: MockScenarioId) => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      setIsScanning(true);

      const finalScan = await runDiagnosticEngine(adapter, scenarioId);

      for (let index = 0; index < finalScan.nodes.length; index += 1) {
        if (runIdRef.current !== runId) return;
        setActiveNodeId(finalScan.nodes[index]?.id);
        setDisplayNodes(buildReplayNodes(finalScan.nodes, index));
        await wait(190);
      }

      if (runIdRef.current !== runId) return;
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
