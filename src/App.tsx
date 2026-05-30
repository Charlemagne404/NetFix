import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { FindingsPanel } from "@/components/dashboard/FindingsPanel";
import { StatusOverview } from "@/components/dashboard/StatusOverview";
import { DiagnosticTimeline } from "@/components/timeline/DiagnosticTimeline";
import { ConfirmFixModal } from "@/components/fixes/ConfirmFixModal";
import { RepairPlanPanel } from "@/components/fixes/RepairPlanPanel";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { RuntimeNotice } from "@/components/runtime/RuntimeNotice";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { createMockScanResult, getDefaultMockScenario } from "@/core/mockData";
import { projectMockScenarioAfterFix } from "@/core/mockRepairOutcomes";
import {
  createLabRuntimeHealth,
  createPreviewRuntimeHealth,
  deriveWorkspaceMode,
  getFixDisabledReason,
  getScanDisabledReason
} from "@/core/runtimeHealth";
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
  EnvironmentInfo,
  FixAction,
  FixConfirmation,
  FixExecutionResult,
  MockScenarioId,
  RepairVerification,
  ReportFormat,
  RuntimeHealth,
  ScanHistoryEntry,
  ScanHistoryReason,
  ScanResult,
  ThemeMode,
  WorkspaceMode
} from "@/core/types";
import { useDiagnosticScan } from "@/hooks/useDiagnosticScan";
import { useFooterMetrics } from "@/hooks/useFooterMetrics";
import { mockAdapter } from "@/platform/mockAdapter";
import { tauriAdapter } from "@/platform/tauriAdapter";
import { TimeoutError, withTimeout } from "@/utils/async";

const FIX_EXECUTION_TIMEOUT_MS = 45_000;

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
    initialDemoMode: false
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
  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo>({
    ...initialAppState.initialScan.environment,
    isWindows: false,
    isTauri: false
  });
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealth>(
    createPreviewRuntimeHealth()
  );
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
  const workspaceMode: WorkspaceMode = deriveWorkspaceMode(runtimeHealth, demoMode);
  const footerMetrics = useFooterMetrics(adapter);

  const {
    scanResult,
    displayNodes,
    isScanning,
    activeNodeId,
    completedNodeIds,
    scanProgress,
    scanError,
    runScan,
    loadScan
  } = useDiagnosticScan({
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
    let cancelled = false;

    void Promise.all([adapter.getEnvironmentInfo(), adapter.getRuntimeHealth()])
      .then(([environment, health]) => {
        if (cancelled) {
          return;
        }

        setEnvironmentInfo(environment);
        setRuntimeHealth(demoMode ? createLabRuntimeHealth() : health);
      })
      .catch((error) => {
        console.warn("Failed to load runtime environment info", error);

        if (!cancelled) {
          const previewEnvironment = {
            ...initialAppState.initialScan.environment,
            isWindows: false,
            isTauri: false
          };
          setEnvironmentInfo(previewEnvironment);
          setRuntimeHealth(
            demoMode
              ? createLabRuntimeHealth()
              : createPreviewRuntimeHealth(previewEnvironment)
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adapter, demoMode, initialAppState.initialScan.environment]);

  useEffect(() => {
    if (showRawOutput) {
      setMode("technician");
    }
  }, [showRawOutput]);

  const selectedNode =
    displayNodes.find((node) => node.id === selectedNodeId) ?? displayNodes[0];
  const totalChecks = scanResult.nodes.reduce((count, node) => count + node.evidence.length, 0);
  const scanActionReason = getScanDisabledReason(runtimeHealth, demoMode);
  const fixDisabledReason = getFixDisabledReason(runtimeHealth, demoMode);
  const canRunScan = !scanActionReason;
  const canRunFixes = !fixDisabledReason;

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
    if (!canRunScan) {
      return;
    }

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
    if (!canRunFixes) {
      setPendingFix(null);
      setFixResult({
        fixId: fix.id,
        status: "blocked",
        title: "Repair action unavailable",
        message: fixDisabledReason ?? "Aegis cannot run live repair actions in this session.",
        requiresAdmin: fix.requiresAdmin
      });
      return;
    }

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
      const result = await withTimeout(
        adapter.runFix(fix, confirmation),
        FIX_EXECUTION_TIMEOUT_MS,
        "The repair command took too long and was stopped before Aegis could verify it."
      );
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
    } catch (error) {
      const message =
        error instanceof TimeoutError
          ? error.message
          : "Aegis could not complete the requested repair action.";
      const blockedResult: FixExecutionResult = {
        fixId: fix.id,
        status: "blocked",
        title: fix.title,
        message,
        requiresAdmin: fix.requiresAdmin
      };

      setFixResult(blockedResult);
      setPendingFix(null);
      setRepairVerification(buildRepairBlockedVerification(beforeScan, blockedResult));
    } finally {
      setFixBusy(false);
      setIsVerifyingFix(false);
    }
  };

  const handleExportReport = (format: ReportFormat) => {
    void adapter.exportReport(scanResult, format);
  };

  return (
    <AppShell
      appVersion={environmentInfo.appVersion}
      scan={scanResult}
      mode={mode}
      theme={theme}
      isScanning={isScanning}
      workspaceMode={workspaceMode}
      environmentInfo={environmentInfo}
      footerMetrics={footerMetrics}
      scanActionEnabled={canRunScan}
      scanActionReason={scanActionReason}
      onModeChange={setMode}
      onThemeChange={setTheme}
      onRunScan={handleRunScan}
      onExportReport={() => setReportOpen(true)}
      onOpenSettings={() => setSettingsOpen(true)}
    >
      <div className="dashboard-viewport grid h-full min-h-0 min-w-0 gap-2 lg:grid-rows-[auto_auto_auto_minmax(0,1fr)]">
        <RuntimeNotice runtimeHealth={runtimeHealth} scanError={scanError} />

        <StatusOverview
          diagnosis={scanResult.diagnosis}
          liveNodes={displayNodes}
          completedChecks={totalChecks}
          lastRunAt={scanResult.createdAt}
          isScanning={isScanning}
          scanProgress={scanProgress}
          totalTimelineNodes={displayNodes.length}
          scanActionEnabled={canRunScan}
          scanActionReason={scanActionReason}
          onRunScan={handleRunScan}
          onViewReport={() => setReportOpen(true)}
        />

        <DiagnosticTimeline
          nodes={displayNodes}
          selectedNodeId={selectedNode?.id}
          activeNodeId={activeNodeId}
          completedNodeIds={completedNodeIds}
          scanProgress={scanProgress}
          onSelectNode={setSelectedNodeId}
          isScanning={isScanning}
        />

        <div className="grid min-w-0 gap-2 lg:min-h-0 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
          <FindingsPanel
            nodes={displayNodes}
            selectedNodeId={selectedNode?.id}
            onSelectNode={setSelectedNodeId}
            onViewDetails={() => setReportOpen(true)}
          />

          <RepairPlanPanel
            diagnosis={scanResult.diagnosis}
            fixResult={fixResult}
            isScanning={isScanning}
            fixesEnabled={canRunFixes}
            fixesDisabledReason={fixDisabledReason}
            scanActionEnabled={canRunScan}
            scanActionReason={scanActionReason}
            onOpenAdvancedOptions={() => setSettingsOpen(true)}
            onRunFix={setPendingFix}
            onRunScan={handleRunScan}
          />
        </div>
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
        environmentInfo={environmentInfo}
        rawOutput={showRawOutput}
        scenarioId={scenarioId}
        onDemoModeChange={setDemoMode}
        onRawOutputChange={setShowRawOutput}
        onScenarioChange={handleScenarioChange}
        onClose={() => setSettingsOpen(false)}
      />
    </AppShell>
  );
}
