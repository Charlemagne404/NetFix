import { invoke } from "@tauri-apps/api/core";
import { createMockScanResult } from "@/core/mockData";
import { buildHtmlReport, buildJsonReport } from "@/core/reportExport";
import type {
  EnvironmentInfo,
  FixExecutionResult,
  MockScenarioId,
  ScanResult
} from "@/core/types";
import type { PlatformAdapter } from "./platformAdapter";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function hasTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

async function invokeWithMockFallback<T>(
  command: string,
  payload: Record<string, unknown>,
  fallback: () => T
): Promise<T> {
  if (!hasTauriRuntime()) {
    return fallback();
  }

  try {
    return await invoke<T>(command, payload);
  } catch (error) {
    console.warn(`Tauri command ${command} failed; using mock fallback`, error);
    return fallback();
  }
}

export const tauriAdapter: PlatformAdapter = {
  kind: "tauri",
  async runScan(scenarioId?: MockScenarioId) {
    return invokeWithMockFallback<ScanResult>(
      "run_scan",
      { scenarioId },
      () => createMockScanResult(scenarioId)
    );
  },
  async runFix(fixId: string) {
    return invokeWithMockFallback<FixExecutionResult>(
      "run_fix",
      { fixId },
      () => ({
        fixId,
        status: "blocked",
        title: "Fix unavailable",
        message:
          "Real fix execution is only available inside the Tauri Windows build. No command was executed."
      })
    );
  },
  async exportReport(scan, format) {
    const content = format === "json" ? buildJsonReport(scan) : buildHtmlReport(scan);
    return invokeWithMockFallback<string>(
      "export_report",
      { scan, format, content },
      () => {
        const blob = new Blob([content], {
          type: format === "json" ? "application/json" : "text/html"
        });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        return `Opened report preview (${format})`;
      }
    );
  },
  async getEnvironmentInfo() {
    return invokeWithMockFallback<EnvironmentInfo>(
      "get_environment_info",
      {},
      () => ({
        os: navigator.platform || "Unknown",
        hostname: "Local browser",
        appVersion: "0.1.0",
        isAdmin: false,
        isWindows: navigator.userAgent.toLowerCase().includes("windows"),
        isTauri: hasTauriRuntime()
      })
    );
  }
};
