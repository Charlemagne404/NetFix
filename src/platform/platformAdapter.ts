import type {
  EnvironmentInfo,
  FixAction,
  FixConfirmation,
  FixExecutionResult,
  MockScenarioId,
  ScanResult
} from "@/core/types";

export type PlatformAdapter = {
  kind: "mock" | "tauri";
  runScan: (scenarioId?: MockScenarioId) => Promise<ScanResult>;
  runFix: (
    fix: FixAction,
    confirmation?: FixConfirmation
  ) => Promise<FixExecutionResult>;
  exportReport: (scan: ScanResult, format: "json" | "html") => Promise<string>;
  getEnvironmentInfo: () => Promise<EnvironmentInfo>;
};
