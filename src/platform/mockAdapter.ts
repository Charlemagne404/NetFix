import { createMockScanResult } from "@/core/mockData";
import { getFixAction } from "@/core/fixRegistry";
import { buildHtmlReport, buildJsonReport, downloadTextFile } from "@/core/reportExport";
import type { PlatformAdapter } from "./platformAdapter";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const mockAdapter: PlatformAdapter = {
  kind: "mock",
  async runScan(scenarioId) {
    await wait(250);
    return createMockScanResult(scenarioId);
  },
  async runFix(fixId) {
    const fix = getFixAction(fixId);
    await wait(450);
    return {
      fixId,
      status: "simulated",
      title: fix.title,
      message:
        "Demo mode simulated the fix. No command was executed and no system setting was changed.",
      stdout: fix.commandsPreview?.join("\n"),
      requiresAdmin: fix.requiresAdmin
    };
  },
  async exportReport(scan, format) {
    const content = format === "json" ? buildJsonReport(scan) : buildHtmlReport(scan);
    const extension = format === "json" ? "json" : "html";
    const filename = `aegis-network-report-${scan.id}.${extension}`;
    downloadTextFile(filename, content, format === "json" ? "application/json" : "text/html");
    return filename;
  },
  async getEnvironmentInfo() {
    return {
      os: navigator.platform || "Unknown",
      hostname: "Local demo",
      appVersion: "0.1.0",
      isAdmin: false,
      isWindows: navigator.userAgent.toLowerCase().includes("windows"),
      isTauri: false
    };
  }
};
