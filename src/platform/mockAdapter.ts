import { createMockScanResult } from "@/core/mockData";
import { createPreviewRuntimeHealth } from "@/core/runtimeHealth";
import { TIMELINE_DEFINITION } from "@/core/timelineDefinition";
import { isAllowlistedFixId } from "@/core/fixRegistry";
import {
  buildHtmlReport,
  buildJsonReport,
  buildZipCaseFile,
  downloadBinaryFile,
  downloadTextFile,
  reportFilename
} from "@/core/reportExport";
import packageInfo from "../../package.json";
import type { PlatformAdapter } from "./platformAdapter";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const mockAdapter: PlatformAdapter = {
  kind: "mock",
  async runScan({ scenarioId, runId, onProgress }) {
    const finalScan = createMockScanResult(scenarioId);

    onProgress?.({
      runId,
      kind: "scan-started",
      totalNodes: TIMELINE_DEFINITION.length,
      message: "Preparing the diagnostic timeline..."
    });

    for (const [index, node] of finalScan.nodes.entries()) {
      onProgress?.({
        runId,
        kind: "node-started",
        nodeId: node.id,
        nodeLabel: node.label,
        nodeIndex: index,
        totalNodes: TIMELINE_DEFINITION.length,
        message: `Checking ${node.label.toLowerCase()} in the live timeline...`
      });
      await wait(260);
      onProgress?.({
        runId,
        kind: "node-completed",
        nodeId: node.id,
        nodeLabel: node.label,
        nodeIndex: index,
        nodeStatus: node.status,
        nodeSummary: node.summary,
        totalNodes: TIMELINE_DEFINITION.length,
        message: node.summary
      });
    }

    await wait(120);
    onProgress?.({
      runId,
      kind: "scan-finished",
      totalNodes: TIMELINE_DEFINITION.length,
      message: "Finalizing the diagnosis..."
    });

    return finalScan;
  },
  async runFix(fix, confirmation) {
    if (!isAllowlistedFixId(fix.id)) {
      return {
        fixId: fix.id,
        status: "blocked",
        title: "Unknown fix",
        message: "The requested fix ID is not in the frontend allowlist.",
        requiresAdmin: false
      };
    }

    await wait(450);
    return {
      fixId: fix.id,
      status: "simulated",
      title: fix.title,
      message:
        confirmation?.acknowledged
          ? "Diagnostic lab simulated the confirmed allowlisted fix. No command was executed and no system setting was changed."
          : "Diagnostic lab simulated the fix. No command was executed and no system setting was changed.",
      stdout: fix.commandsPreview?.join("\n"),
      requiresAdmin: fix.requiresAdmin
    };
  },
  async exportReport(scan, format) {
    const filename = reportFilename(scan, format);

    if (format === "zip") {
      const content = await buildZipCaseFile(scan);
      downloadBinaryFile(filename, content, "application/zip");
      return filename;
    }

    const content = format === "json" ? buildJsonReport(scan) : buildHtmlReport(scan);
    downloadTextFile(filename, content, format === "json" ? "application/json" : "text/html");
    return filename;
  },
  async getEnvironmentInfo() {
    return {
      os: navigator.platform || "Unknown",
      hostname: "Preview workspace",
      appVersion: packageInfo.version,
      isAdmin: false,
      isWindows: navigator.userAgent.toLowerCase().includes("windows"),
      isTauri: false
    };
  },
  async getRuntimeHealth() {
    return createPreviewRuntimeHealth({
      isWindows: navigator.userAgent.toLowerCase().includes("windows"),
      isTauri: false
    });
  },
  async getSystemMetrics() {
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
};
