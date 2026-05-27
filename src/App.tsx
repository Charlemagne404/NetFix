import { useEffect, useMemo, useState, startTransition } from "react";
import { AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { FindingsPanel } from "@/components/dashboard/FindingsPanel";
import { StatusOverview } from "@/components/dashboard/StatusOverview";
import { DiagnosticTimeline } from "@/components/timeline/DiagnosticTimeline";
import { ConfirmFixModal } from "@/components/fixes/ConfirmFixModal";
import { RepairPlanPanel } from "@/components/fixes/RepairPlanPanel";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { createMockScanResult, getDefaultMockScenario } from "@/core/mockData";
import type {
  AppMode,
  FixAction,
  FixConfirmation,
  FixExecutionResult,
  MockScenarioId,
  ScanResult,
  ThemeMode
} from "@/core/types";
import { useDiagnosticScan } from "@/hooks/useDiagnosticScan";
import { mockAdapter } from "@/platform/mockAdapter";
import { tauriAdapter } from "@/platform/tauriAdapter";

const initialScenario = getDefaultMockScenario();
const initialScan = createMockScanResult(initialScenario);

export default function App() {
  const [scenarioId, setScenarioId] = useState<MockScenarioId>(initialScenario);
  const [selectedNodeId, setSelectedNodeId] = useState(
    initialScan.diagnosis.primaryFailedNodeId ?? initialScan.nodes[0]?.id
  );
  const [mode, setMode] = useState<AppMode>("normal");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [demoMode, setDemoMode] = useState(true);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [pendingFix, setPendingFix] = useState<FixAction | null>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const [fixResult, setFixResult] = useState<FixExecutionResult | null>(null);

  const adapter = useMemo(() => (demoMode ? mockAdapter : tauriAdapter), [demoMode]);

  const { scanResult, displayNodes, isScanning, activeNodeId, runScan } =
    useDiagnosticScan({
      adapter,
      initialScan,
      onScanComplete: (scan) => {
        setSelectedNodeId(scan.diagnosis.primaryFailedNodeId ?? scan.nodes[0]?.id);
      }
    });

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
  const totalChecks = scanResult.nodes.reduce((count, node) => count + node.checks.length, 0);

  const handleScenarioChange = (nextScenario: MockScenarioId) => {
    startTransition(() => {
      setScenarioId(nextScenario);
      setFixResult(null);
    });
    void runScan(nextScenario);
  };

  const handleRunScan = () => {
    setFixResult(null);
    void runScan(scenarioId);
  };

  const handleOpenRecommendedFix = () => {
    const fix = scanResult.diagnosis.recommendedFixes[0];
    if (fix) {
      setPendingFix(fix);
    }
  };

  const handleConfirmFix = async (fix: FixAction, confirmation?: FixConfirmation) => {
    setFixBusy(true);
    try {
      const result = await adapter.runFix(fix, confirmation);
      setFixResult(result);
      setPendingFix(null);
    } finally {
      setFixBusy(false);
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
      <div className="grid min-w-0 gap-3 lg:h-full lg:min-h-0 lg:grid-rows-[auto_auto_minmax(0,1fr)]">
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
