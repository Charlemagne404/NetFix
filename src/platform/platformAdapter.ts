import type {
  EnvironmentInfo,
  FixExecutionResult,
  MockScenarioId,
  ScanResult
} from "@/core/types";

export type PlatformAdapter = {
  kind: "mock" | "tauri";
  runScan: (scenarioId?: MockScenarioId) => Promise<ScanResult>;
  runFix: (fixId: string) => Promise<FixExecutionResult>;
  exportReport: (scan: ScanResult, format: "json" | "html") => Promise<string>;
  getEnvironmentInfo: () => Promise<EnvironmentInfo>;
};
