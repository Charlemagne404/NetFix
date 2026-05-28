import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createMockScanResult } from "@/core/mockData";
import { isAllowlistedFixId } from "@/core/fixRegistry";
import {
  buildHtmlReport,
  buildJsonReport,
  buildZipCaseFile,
  downloadBinaryFile,
  downloadTextFile,
  reportFilename,
  uint8ArrayToBase64
} from "@/core/reportExport";
import packageInfo from "../../package.json";
import type {
  EnvironmentInfo,
  FixAction,
  FixConfirmation,
  FixExecutionResult,
  ReportFormat,
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

type SerializedReportPayload = {
  content: string;
  encoding: "utf8" | "base64";
  mimeType: string;
};

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

async function serializeReport(
  scan: ScanResult,
  format: ReportFormat
): Promise<SerializedReportPayload> {
  if (format === "json") {
    return {
      content: buildJsonReport(scan),
      encoding: "utf8",
      mimeType: "application/json"
    };
  }

  if (format === "html") {
    return {
      content: buildHtmlReport(scan),
      encoding: "utf8",
      mimeType: "text/html"
    };
  }

  const content = await buildZipCaseFile(scan);
  return {
    content: uint8ArrayToBase64(content),
    encoding: "base64",
    mimeType: "application/zip"
  };
}

async function exportReportFallback(
  scan: ScanResult,
  format: ReportFormat,
  payload: SerializedReportPayload
): Promise<string> {
  const filename = reportFilename(scan, format);

  if (format === "zip") {
    const content = await buildZipCaseFile(scan);
    downloadBinaryFile(filename, content, payload.mimeType);
    return filename;
  }

  downloadTextFile(filename, payload.content, payload.mimeType);
  return filename;
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
        ? await listen<ScanProgress>("aegis-trace://scan-progress", (event) => {
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
    const payload = await serializeReport(scan, format);

    if (!hasTauriRuntime()) {
      return exportReportFallback(scan, format, payload);
    }

    try {
      return await invoke<string>("export_report", {
        scan,
        format,
        content: payload.content,
        encoding: payload.encoding
      });
    } catch (error) {
      console.warn("Tauri command export_report failed; using browser fallback", error);
      return exportReportFallback(scan, format, payload);
    }
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
