import { useCallback, useRef, useState } from "react";
import { runDiagnosticEngine } from "@/core/diagnosticEngine";
import type { DiagnosticNode, MockScenarioId, ScanProgress, ScanResult } from "@/core/types";
import type { PlatformAdapter } from "@/platform/platformAdapter";
import { TimeoutError, withTimeout } from "@/utils/async";

type UseDiagnosticScanInput = {
  adapter: PlatformAdapter;
  initialScan: ScanResult;
  onScanComplete?: (scan: ScanResult) => void;
};

const SCAN_TIMEOUT_MS = 150_000;

function buildPendingNodes(nodes: DiagnosticNode[]): DiagnosticNode[] {
  return nodes.map((node) => ({
    ...node,
    evidence: [],
    likelyCauses: [],
    recommendedFixes: [],
    rawOutput: undefined,
    status: "pending",
    severity: "info",
    progressState: "queued",
    summary: "Queued for scan...",
    explanation: "Aegis will fill this stage as soon as the live scan reaches it."
  }));
}

function buildLiveNodes(
  nodes: DiagnosticNode[],
  activeNodeId: string | undefined,
  completedNodeIds: string[],
  activeMessage: string | undefined
): DiagnosticNode[] {
  const completedNodeIdSet = new Set(completedNodeIds);

  return nodes.map((node) => {
    if (node.id === activeNodeId) {
      return {
        ...node,
        status: "running",
        severity: "info",
        progressState: "running",
        summary: activeMessage ?? `Checking ${node.label.toLowerCase()}...`
      };
    }

    if (completedNodeIdSet.has(node.id)) {
      return {
        ...node,
        status: "pending",
        severity: "info",
        progressState: "checked",
        summary: "Evidence collected. Waiting for the remaining checks..."
      };
    }

    return {
      ...node,
      status: "pending",
      severity: "info",
      progressState: "queued",
      summary: "Waiting for earlier checks..."
    };
  });
}

function createScanRunId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
  const [completedNodeIds, setCompletedNodeIds] = useState<string[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgress | undefined>();
  const [scanError, setScanError] = useState<string | undefined>();
  const runIdRef = useRef(0);
  const scanResultRef = useRef(initialScan);
  const activeNodeIdRef = useRef<string | undefined>(undefined);
  const completedNodeIdsRef = useRef<string[]>([]);
  const isScanningRef = useRef(false);

  const isStaleRun = (runId: number) => runIdRef.current !== runId;

  const resetLiveState = useCallback(() => {
    activeNodeIdRef.current = undefined;
    completedNodeIdsRef.current = [];
    setActiveNodeId(undefined);
    setCompletedNodeIds([]);
    setScanProgress(undefined);
  }, []);

  const syncLiveNodes = useCallback((message?: string) => {
    setDisplayNodes((currentNodes) =>
      buildLiveNodes(
        currentNodes,
        activeNodeIdRef.current,
        completedNodeIdsRef.current,
        message ?? scanProgress?.message
      )
    );
  }, [scanProgress?.message]);

  const loadScan = useCallback((nextScan: ScanResult) => {
    runIdRef.current += 1;
    scanResultRef.current = nextScan;
    setScanResult(nextScan);
    setDisplayNodes(nextScan.nodes);
    resetLiveState();
    setIsScanning(false);
    isScanningRef.current = false;
    setScanError(undefined);
  }, [resetLiveState]);

  const runScan = useCallback(
    async (scenarioId?: MockScenarioId) => {
      if (isScanningRef.current) {
        return undefined;
      }

      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      const scanRunId = createScanRunId();
      isScanningRef.current = true;
      setIsScanning(true);
      setScanError(undefined);
      resetLiveState();
      setDisplayNodes(buildPendingNodes(scanResultRef.current.nodes));

      let finalScan: ScanResult;
      try {
        finalScan = await withTimeout(
          runDiagnosticEngine(adapter, {
            scenarioId,
            runId: scanRunId,
            onProgress: (progress) => {
              if (isStaleRun(runId)) return;

              setScanProgress(progress);

              if (progress.kind === "node-started") {
                if (activeNodeIdRef.current && activeNodeIdRef.current !== progress.nodeId) {
                  completedNodeIdsRef.current = [
                    ...completedNodeIdsRef.current,
                    activeNodeIdRef.current
                  ];
                  setCompletedNodeIds(completedNodeIdsRef.current);
                }

                activeNodeIdRef.current = progress.nodeId;
                setActiveNodeId(progress.nodeId);
                syncLiveNodes(progress.message);
                return;
              }

              if (progress.kind === "scan-finished") {
                syncLiveNodes(progress.message);
              }
            }
          }),
          SCAN_TIMEOUT_MS,
          "The diagnostic scan took too long and was stopped."
        );
      } catch (error) {
        if (!isStaleRun(runId)) {
          const message =
            error instanceof TimeoutError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Aegis could not complete the diagnostic scan.";
          console.warn("Diagnostic scan did not complete", error);
          runIdRef.current += 1;
          setDisplayNodes(scanResultRef.current.nodes);
          resetLiveState();
          setIsScanning(false);
          isScanningRef.current = false;
          setScanError(message);
        }
        return undefined;
      }

      if (isStaleRun(runId)) return undefined;
      scanResultRef.current = finalScan;
      setScanResult(finalScan);
      setDisplayNodes(finalScan.nodes);
      resetLiveState();
      setIsScanning(false);
      isScanningRef.current = false;
      setScanError(undefined);
      onScanComplete?.(finalScan);
      return finalScan;
    },
    [adapter, onScanComplete, resetLiveState, syncLiveNodes]
  );

  return {
    scanResult,
    displayNodes,
    isScanning,
    activeNodeId,
    completedNodeIds,
    scanProgress,
    scanError,
    runScan,
    loadScan
  };
}
