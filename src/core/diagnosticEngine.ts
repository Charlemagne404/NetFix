import { createMockScanResult } from "./mockData";
import type { MockScenarioId, ScanResult } from "./types";
import type { PlatformAdapter } from "@/platform/platformAdapter";

export async function runDiagnosticEngine(
  adapter: PlatformAdapter,
  scenarioId?: MockScenarioId
): Promise<ScanResult> {
  try {
    return await adapter.runScan(scenarioId);
  } catch (error) {
    console.warn("Diagnostic adapter failed; using mock fallback", error);
    return createMockScanResult(scenarioId);
  }
}
