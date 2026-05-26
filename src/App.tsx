import { useEffect, useMemo, useState, startTransition } from "react";
import { AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { StatusOverview } from "@/components/dashboard/StatusOverview";
import { DiagnosticTimeline } from "@/components/timeline/DiagnosticTimeline";
import { DetailsPanel } from "@/components/details/DetailsPanel";
import { ConfirmFixModal } from "@/components/fixes/ConfirmFixModal";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { RecentScans } from "@/components/dashboard/RecentScans";
import { createMockScanResult, getDefaultMockScenario } from "@/core/mockData";
import type {
  AppMode,
  FixAction,
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
  const [recentScans, setRecentScans] = useState<ScanResult[]>([initialScan]);

  const adapter = useMemo(() => (demoMode ? mockAdapter : tauriAdapter), [demoMode]);

  const { scanResult, displayNodes, isScanning, activeNodeId, runScan } =
    useDiagnosticScan({
      adapter,
      initialScan,
      onScanComplete: (scan) => {
        setRecentScans((current) => [scan, ...current].slice(0, 3));
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

  const handleConfirmFix = async (fix: FixAction) => {
    setFixBusy(true);
    try {
      const result = await adapter.runFix(fix.id);
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
      <div className="grid gap-5">
        <StatusOverview
          diagnosis={scanResult.diagnosis}
          isScanning={isScanning}
          onRunScan={handleRunScan}
          onApplyRecommendedFix={handleOpenRecommendedFix}
          onViewReport={() => setReportOpen(true)}
        />

        <DiagnosticTimeline
          nodes={displayNodes}
          selectedNodeId={selectedNode?.id}
          onSelectNode={setSelectedNodeId}
          isScanning={isScanning}
        />

        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          {selectedNode ? (
            <DetailsPanel node={selectedNode} mode={mode} onRunFix={setPendingFix} />
          ) : null}

          <aside className="grid gap-5 content-start">
            <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-panel backdrop-blur-2xl">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Ranked safe actions
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Aegis ranks fixes by evidence and safety. Aggressive actions are advanced and never auto-run.
              </p>
              <div className="mt-4 space-y-3">
                {scanResult.diagnosis.recommendedFixes.slice(0, 3).map((fix) => (
                  <button
                    key={fix.id}
                    type="button"
                    onClick={() => setPendingFix(fix)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-left transition hover:border-cyan-300/30 hover:bg-slate-900/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-white">{fix.title}</span>
                      <span className="text-xs font-semibold capitalize text-cyan-100">
                        {fix.safety}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-slate-400">
                      {fix.estimatedImpact}
                    </p>
                  </button>
                ))}
                {!scanResult.diagnosis.recommendedFixes.length ? (
                  <p className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
                    No repair action is needed for this scan.
                  </p>
                ) : null}
              </div>
            </section>

            <RecentScans scans={recentScans} />

            {fixResult ? (
              <section className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5 shadow-panel">
                <h2 className="text-lg font-semibold text-white">{fixResult.title}</h2>
                <p className="mt-2 text-sm leading-6 text-cyan-50/85">
                  {fixResult.message}
                </p>
              </section>
            ) : null}
          </aside>
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
