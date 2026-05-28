import type {
  EnvironmentInfo,
  FixAction,
  FixConfirmation,
  FixExecutionResult,
  MockScenarioId,
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
  exportReport: (scan: ScanResult, format: "json" | "html") => Promise<string>;
  getEnvironmentInfo: () => Promise<EnvironmentInfo>;
  getSystemMetrics: () => Promise<SystemMetrics>;
};
