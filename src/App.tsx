import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { FindingsPanel } from "@/components/dashboard/FindingsPanel";
import { RecentScans } from "@/components/dashboard/RecentScans";
import { StatusOverview } from "@/components/dashboard/StatusOverview";
import { DiagnosticTimeline } from "@/components/timeline/DiagnosticTimeline";
import { DetailsPanel } from "@/components/details/DetailsPanel";
import { ConfirmFixModal } from "@/components/fixes/ConfirmFixModal";
import { RepairPlanPanel } from "@/components/fixes/RepairPlanPanel";
import { RepairVerificationPanel } from "@/components/fixes/RepairVerificationPanel";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { createMockScanResult, getDefaultMockScenario } from "@/core/mockData";
import { projectMockScenarioAfterFix } from "@/core/mockRepairOutcomes";
import {
  buildRepairBlockedVerification,
  buildRepairVerification
} from "@/core/repairVerification";
import {
  clearScanHistory,
  loadScanHistory,
  saveScanHistory,
  upsertScanHistoryEntry
} from "@/core/scanHistory";
import type {
  AppMode,
  FixAction,
  FixConfirmation,
  FixExecutionResult,
  MockScenarioId,
  RepairVerification,
  ScanHistoryEntry,
  ScanHistoryReason,
  ScanResult,
  ThemeMode
} from "@/core/types";
import { useDiagnosticScan } from "@/hooks/useDiagnosticScan";
import { mockAdapter } from "@/platform/mockAdapter";
import { tauriAdapter } from "@/platform/tauriAdapter";

type PendingHistoryCapture = {
  reason: ScanHistoryReason;
  scenarioId?: MockScenarioId;
  relatedFixId?: string;
  relatedFixTitle?: string;
};

function createHistoryEntry(
  scan: ScanResult,
  capture: PendingHistoryCapture
): ScanHistoryEntry {
  return {
    id: `${scan.id}-${capture.reason}-${capture.relatedFixId ?? "scan"}`,
    capturedAt: scan.createdAt,
    reason: capture.reason,
    scenarioId: capture.scenarioId,
    relatedFixId: capture.relatedFixId,
    relatedFixTitle: capture.relatedFixTitle,
    scan
  };
}

function resolveInitialAppState() {
  const history = loadScanHistory();
  const latestEntry = history[0];
  const fallbackScenario = getDefaultMockScenario();
  const initialScenarioId = latestEntry?.scenarioId ?? fallbackScenario;

  return {
    history,
    initialScenarioId,
    initialScan: latestEntry?.scan ?? createMockScanResult(initialScenarioId),
    initialDemoMode: latestEntry ? latestEntry.scan.mode !== "real" : true
  };
}

export default function App() {
  const initialAppState = useRef(resolveInitialAppState()).current;
  const [scenarioId, setScenarioId] = useState<MockScenarioId>(
    initialAppState.initialScenarioId
  );
  const [selectedNodeId, setSelectedNodeId] = useState(
    initialAppState.initialScan.diagnosis.primaryFailedNodeId ??
      initialAppState.initialScan.nodes[0]?.id
  );
  const [mode, setMode] = useState<AppMode>("normal");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [demoMode, setDemoMode] = useState(initialAppState.initialDemoMode);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [pendingFix, setPendingFix] = useState<FixAction | null>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const [fixResult, setFixResult] = useState<FixExecutionResult | null>(null);
  const [repairVerification, setRepairVerification] =
    useState<RepairVerification | null>(null);
  const [isVerifyingFix, setIsVerifyingFix] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>(
    initialAppState.history
  );
  const pendingHistoryCaptureRef = useRef<PendingHistoryCapture>({
    reason: "manual",
    scenarioId: initialAppState.initialScenarioId
  });

  const adapter = useMemo(() => (demoMode ? mockAdapter : tauriAdapter), [demoMode]);

  const { scanResult, displayNodes, isScanning, activeNodeId, runScan, loadScan } =
    useDiagnosticScan({
      adapter,
      initialScan: initialAppState.initialScan,
      onScanComplete: (scan) => {
        setSelectedNodeId(scan.diagnosis.primaryFailedNodeId ?? scan.nodes[0]?.id);
        setScanHistory((currentHistory) =>
          upsertScanHistoryEntry(
            currentHistory,
            createHistoryEntry(scan, pendingHistoryCaptureRef.current)
          )
        );
      }
    });

  useEffect(() => {
    if (scanHistory.length) {
      saveScanHistory(scanHistory);
    } else {
      clearScanHistory();
    }
  }, [scanHistory]);

  useEffect(() => {
    if (activeNodeId) {
      setSelectedNodeId(activeNodeId);
    }
  }, [activeNodeId]);

  useEffect(() => {
    if (showRawOutput) {
      setMode("technician");
    }
  }, [showRawOutput]);

  const selectedNode =
    displayNodes.find((node) => node.id === selectedNodeId) ?? displayNodes[0];
  const totalChecks = scanResult.nodes.reduce((count, node) => count + node.evidence.length, 0);

  const handleScenarioChange = (nextScenario: MockScenarioId) => {
    pendingHistoryCaptureRef.current = {
      reason: "scenario",
      scenarioId: nextScenario
    };

    startTransition(() => {
      setScenarioId(nextScenario);
      setFixResult(null);
    });
    void runScan(nextScenario);
  };

  const handleRunScan = () => {
    pendingHistoryCaptureRef.current = {
      reason: "manual",
      scenarioId
    };
    setFixResult(null);
    void runScan(scenarioId);
  };

  const handleSelectHistoryEntry = (entry: ScanHistoryEntry) => {
    loadScan(entry.scan);
    setSelectedNodeId(entry.scan.diagnosis.primaryFailedNodeId ?? entry.scan.nodes[0]?.id);
    setFixResult(null);
    setPendingFix(null);
    setRepairVerification(null);
    setIsVerifyingFix(false);
    if (entry.scenarioId) {
      setScenarioId(entry.scenarioId);
    }
  };

  const handleConfirmFix = async (fix: FixAction, confirmation?: FixConfirmation) => {
    const beforeScan = scanResult;
    setFixBusy(true);
    setRepairVerification(null);
    setScanHistory((currentHistory) =>
      upsertScanHistoryEntry(
        currentHistory,
        createHistoryEntry(beforeScan, {
          reason: "manual",
          scenarioId
        })
      )
    );
    try {
      const result = await adapter.runFix(fix, confirmation);
      setFixResult(result);
      setPendingFix(null);

      if (result.status === "success" || result.status === "simulated") {
        const nextScenario = demoMode
          ? projectMockScenarioAfterFix(scenarioId, fix.id)
          : scenarioId;

        if (demoMode && nextScenario !== scenarioId) {
          startTransition(() => setScenarioId(nextScenario));
        }

        setIsVerifyingFix(true);
        pendingHistoryCaptureRef.current = {
          reason: "verification",
          scenarioId: demoMode ? nextScenario : scenarioId,
          relatedFixId: fix.id,
          relatedFixTitle: fix.title
        };

        const afterScan = await runScan(nextScenario);
        if (afterScan) {
          setRepairVerification(buildRepairVerification(beforeScan, afterScan, result));
        } else {
          setRepairVerification(
            buildRepairBlockedVerification(beforeScan, {
              ...result,
              status: "blocked",
              message: "The verification scan did not complete."
            })
          );
        }
      } else {
        setRepairVerification(buildRepairBlockedVerification(beforeScan, result));
      }
    } finally {
      setFixBusy(false);
      setIsVerifyingFix(false);
    }
  };

  const handleExportReport = (format: "json" | "html") => {
    void adapter.exportReport(scanResult, format);
  };

  return (
    <AppShell
      scan={scanResult}
      mode={mode}
      theme={theme}
      scenarioId={scenarioId}
      isScanning={isScanning}
      demoMode={demoMode}
      onModeChange={setMode}
      onThemeChange={setTheme}
      onScenarioChange={handleScenarioChange}
      onRunScan={handleRunScan}
      onExportReport={() => setReportOpen(true)}
      onOpenSettings={() => setSettingsOpen(true)}
    >
      <div className="grid min-w-0 gap-3 lg:h-full lg:min-h-0 lg:grid-rows-[auto_auto_auto_minmax(0,1fr)]">
        <StatusOverview
          diagnosis={scanResult.diagnosis}
          completedChecks={totalChecks}
          lastRunAt={scanResult.createdAt}
          isScanning={isScanning}
          onRunScan={handleRunScan}
          onViewReport={() => setReportOpen(true)}
        />

        <DiagnosticTimeline
          nodes={displayNodes}
          selectedNodeId={selectedNode?.id}
          activeNodeId={activeNodeId}
          onSelectNode={setSelectedNodeId}
          isScanning={isScanning}
        />

        <div className="grid min-w-0 gap-3 lg:min-h-0 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
          <FindingsPanel
            scan={scanResult}
            selectedNodeId={selectedNode?.id}
            mode={mode}
            onSelectNode={setSelectedNodeId}
            onViewReport={() => setReportOpen(true)}
            onOpenTechnician={() => setMode("technician")}
          />

          <RepairPlanPanel
            diagnosis={scanResult.diagnosis}
            fixResult={fixResult}
            isScanning={isScanning}
            onOpenAdvancedOptions={() => setSettingsOpen(true)}
            onRunFix={setPendingFix}
            onRunScan={handleRunScan}
            onViewReport={() => setReportOpen(true)}
          />
        </div>

        {selectedNode ? (
          <div className="grid min-w-0 gap-3 lg:min-h-0 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
            <DetailsPanel node={selectedNode} mode={mode} onRunFix={setPendingFix} />

            <div className="grid min-w-0 gap-3 content-start">
              <RepairVerificationPanel
                verification={repairVerification}
                fixResult={fixResult}
                isVerifying={isVerifyingFix}
              />

              <RecentScans
                entries={scanHistory}
                activeScanId={scanResult.id}
                onSelectScan={handleSelectHistoryEntry}
                onClearHistory={() => setScanHistory([])}
              />
            </div>
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        <ConfirmFixModal
          fix={pendingFix}
          busy={fixBusy}
          onCancel={() => setPendingFix(null)}
          onConfirm={handleConfirmFix}
        />
      </AnimatePresence>

      {reportOpen ? (
        <ReportPreview
          scan={scanResult}
          onClose={() => setReportOpen(false)}
          onExport={handleExportReport}
        />
      ) : null}

      <SettingsPanel
        open={settingsOpen}
        demoMode={demoMode}
        rawOutput={showRawOutput}
        onDemoModeChange={setDemoMode}
        onRawOutputChange={setShowRawOutput}
        onClose={() => setSettingsOpen(false)}
      />
    </AppShell>
  );
}
