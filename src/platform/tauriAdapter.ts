import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createMockScanResult } from "@/core/mockData";
import { isAllowlistedFixId } from "@/core/fixRegistry";
import { buildHtmlReport, buildJsonReport } from "@/core/reportExport";
import packageInfo from "../../package.json";
import type {
  EnvironmentInfo,
  FixAction,
  FixConfirmation,
  FixExecutionResult,
  ScanProgress,
  ScanResult,
  SystemMetrics
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

function browserEnvironmentInfo(): EnvironmentInfo {
  return {
    os: navigator.platform || "Unknown",
    hostname: "Local browser",
    appVersion: packageInfo.version,
    isAdmin: false,
    isWindows: navigator.userAgent.toLowerCase().includes("windows"),
    isTauri: hasTauriRuntime()
  };
}

function browserSystemMetrics(): SystemMetrics {
  const memory = "memory" in performance ? (performance as Performance & {
    memory?: {
      usedJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }).memory : undefined;

  return {
    collectedAt: new Date().toISOString(),
    source: "browser",
    uptimeSeconds: Math.round(performance.now() / 1000),
    cpuUsagePercent: null,
    memoryUsedBytes: memory?.usedJSHeapSize ?? null,
    memoryTotalBytes: memory?.jsHeapSizeLimit ?? null,
    networkReceivedBytes: null,
    networkTransmittedBytes: null
  };
}

let environmentInfoPromise: Promise<EnvironmentInfo> | undefined;

async function getResolvedEnvironmentInfo(): Promise<EnvironmentInfo> {
  if (!hasTauriRuntime()) {
    return browserEnvironmentInfo();
  }

  if (!environmentInfoPromise) {
    environmentInfoPromise = invoke<EnvironmentInfo>("get_environment_info", {}).catch((error) => {
      console.warn("Tauri command get_environment_info failed; using browser fallback", error);
      return browserEnvironmentInfo();
    });
  }

  return environmentInfoPromise;
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
  async runScan({ scenarioId, runId, onProgress }) {
    const environment = await getResolvedEnvironmentInfo();
    if (!environment.isWindows) {
      return createMockScanResult(scenarioId);
    }

    const unlisten =
      onProgress && hasTauriRuntime()
        ? await listen<ScanProgress>("aegis://scan-progress", (event) => {
            if (event.payload.runId === runId) {
              onProgress(event.payload);
            }
          })
        : undefined;

    try {
      return await invokeWithMockFallback<ScanResult>(
        "run_scan",
        { scenarioId, runId },
        () => createMockScanResult(scenarioId)
      );
    } finally {
      await unlisten?.();
    }
  },
  async runFix(fix: FixAction, confirmation?: FixConfirmation) {
    if (!isAllowlistedFixId(fix.id)) {
      return {
        fixId: fix.id,
        status: "blocked",
        title: "Unknown fix",
        message: "The requested fix ID is not in the frontend allowlist."
      };
    }

    const environment = await getResolvedEnvironmentInfo();
    if (!environment.isWindows) {
      return {
        fixId: fix.id,
        status: "blocked",
        title: "Fix unavailable",
        message:
          "Real fix execution is only available inside the Windows Tauri build. No command was executed."
      };
    }

    return invokeWithMockFallback<FixExecutionResult>(
      "run_fix",
      { fixId: fix.id, confirmation },
      () => ({
        fixId: fix.id,
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
    return getResolvedEnvironmentInfo();
  },
  async getSystemMetrics() {
    return invokeWithMockFallback<SystemMetrics>(
      "get_system_metrics",
      {},
      browserSystemMetrics
    );
  }
};
