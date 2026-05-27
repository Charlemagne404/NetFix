import { describe, expect, it } from "vitest";
import { createMockScanResult } from "./mockData";
import { projectMockScenarioAfterFix } from "./mockRepairOutcomes";
import {
  buildRepairBlockedVerification,
  buildRepairVerification
} from "./repairVerification";

describe("repair verification", () => {
  it("marks a repair as resolved when the verification scan clears the failure", () => {
    const beforeScan = createMockScanResult("dns-failure");
    const afterScan = createMockScanResult(
      projectMockScenarioAfterFix("dns-failure", "flush-dns")
    );

    const verification = buildRepairVerification(beforeScan, afterScan, {
      fixId: "flush-dns",
      status: "simulated",
      title: "Flush DNS cache",
      message: "Simulated fix"
    });

    expect(verification.status).toBe("resolved");
    expect(verification.afterDiagnosis).toBe("Everything looks good");
    expect(verification.changedNodes.some((node) => node.nodeId === "dns")).toBe(true);
  });

  it("marks a repair as unchanged when the verification scan keeps the same failure", () => {
    const beforeScan = createMockScanResult("internet-unreachable");
    const afterScan = createMockScanResult("internet-unreachable");

    const verification = buildRepairVerification(beforeScan, afterScan, {
      fixId: "generate-wlan-report",
      status: "simulated",
      title: "Generate WLAN report",
      message: "Simulated fix"
    });

    expect(verification.status).toBe("unchanged");
    expect(verification.afterDiagnosis).toBe(beforeScan.diagnosis.title);
  });

  it("builds a blocked verification summary when a fix does not execute", () => {
    const beforeScan = createMockScanResult("dhcp-apipa");

    const verification = buildRepairBlockedVerification(beforeScan, {
      fixId: "restart-adapter",
      status: "blocked",
      title: "Restart selected adapter",
      message: "Confirmation required"
    });

    expect(verification.status).toBe("blocked");
    expect(verification.detail).toContain("Confirmation required");
  });
});
