import { createMockScanResult } from "./mockData";
import type { ScanResult } from "./types";
import type { PlatformAdapter, RunScanOptions } from "@/platform/platformAdapter";

export async function runDiagnosticEngine(
  adapter: PlatformAdapter,
  options: RunScanOptions
): Promise<ScanResult> {
  try {
    return await adapter.runScan(options);
  } catch (error) {
    console.warn("Diagnostic adapter failed; using mock fallback", error);
    return createMockScanResult(options.scenarioId);
  }
}
