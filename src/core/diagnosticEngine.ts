import type { ScanResult } from "./types";
import type { PlatformAdapter, RunScanOptions } from "@/platform/platformAdapter";

export async function runDiagnosticEngine(
  adapter: PlatformAdapter,
  options: RunScanOptions
): Promise<ScanResult> {
  return adapter.runScan(options);
}
