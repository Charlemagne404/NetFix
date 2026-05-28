import type {
  EnvironmentInfo,
  FixAction,
  FixConfirmation,
  FixExecutionResult,
  MockScenarioId,
  ReportFormat,
  RuntimeHealth,
  ScanProgress,
  ScanResult,
  SystemMetrics
} from "@/core/types";

export type RunScanOptions = {
  runId: string;
  scenarioId?: MockScenarioId;
  onProgress?: (progress: ScanProgress) => void;
};

export type PlatformAdapter = {
  kind: "mock" | "tauri";
  runScan: (options: RunScanOptions) => Promise<ScanResult>;
  runFix: (
    fix: FixAction,
    confirmation?: FixConfirmation
  ) => Promise<FixExecutionResult>;
  exportReport: (scan: ScanResult, format: ReportFormat) => Promise<string>;
  getEnvironmentInfo: () => Promise<EnvironmentInfo>;
  getRuntimeHealth: () => Promise<RuntimeHealth>;
  getSystemMetrics: () => Promise<SystemMetrics>;
};
