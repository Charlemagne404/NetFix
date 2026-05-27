import type {
  DiagnosticNode,
  DiagnosticStatus,
  FixExecutionResult,
  RepairNodeTransition,
  RepairVerification,
  RepairVerificationStatus,
  ScanResult
} from "./types";

function statusRiskScore(status: DiagnosticStatus) {
  if (status === "failed") return 5;
  if (status === "warning") return 4;
  if (status === "unknown" || status === "skipped") return 3;
  if (status === "running" || status === "pending") return 2;
  return 0;
}

function problemNodeCount(scan: ScanResult) {
  return scan.nodes.filter((node) => statusRiskScore(node.status) >= 3).length;
}

function nodeMap(nodes: DiagnosticNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function collectNodeTransitions(
  beforeScan: ScanResult,
  afterScan: ScanResult
): RepairNodeTransition[] {
  const afterNodes = nodeMap(afterScan.nodes);

  return beforeScan.nodes
    .map((beforeNode) => {
      const afterNode = afterNodes.get(beforeNode.id);
      if (!afterNode) {
        return null;
      }

      if (
        beforeNode.status === afterNode.status &&
        beforeNode.summary === afterNode.summary
      ) {
        return null;
      }

      return {
        nodeId: beforeNode.id,
        label: beforeNode.label,
        beforeStatus: beforeNode.status,
        afterStatus: afterNode.status,
        beforeSummary: beforeNode.summary,
        afterSummary: afterNode.summary
      } satisfies RepairNodeTransition;
    })
    .filter((transition): transition is RepairNodeTransition => Boolean(transition));
}

function resolveVerificationStatus(
  beforeScan: ScanResult,
  afterScan: ScanResult,
  changedNodes: RepairNodeTransition[]
): RepairVerificationStatus {
  const beforePrimaryNode = beforeScan.nodes.find(
    (node) => node.id === beforeScan.diagnosis.primaryFailedNodeId
  );
  const afterPrimaryNode = afterScan.nodes.find(
    (node) => node.id === beforePrimaryNode?.id
  );
  const overallDelta =
    statusRiskScore(beforeScan.overallStatus) - statusRiskScore(afterScan.overallStatus);
  const primaryDelta =
    beforePrimaryNode && afterPrimaryNode
      ? statusRiskScore(beforePrimaryNode.status) -
        statusRiskScore(afterPrimaryNode.status)
      : 0;
  const problemDelta = problemNodeCount(beforeScan) - problemNodeCount(afterScan);

  if (afterScan.overallStatus === "ok" && beforeScan.overallStatus !== "ok") {
    return "resolved";
  }

  if (overallDelta < 0 || problemDelta < 0) {
    return "worse";
  }

  if (overallDelta > 0 || primaryDelta > 0 || problemDelta > 0) {
    return "improved";
  }

  if (!changedNodes.length || beforeScan.diagnosis.id === afterScan.diagnosis.id) {
    return "unchanged";
  }

  return "improved";
}

function buildSummary(
  fixTitle: string,
  status: RepairVerificationStatus
): { summary: string; detail: string } {
  if (status === "resolved") {
    return {
      summary: `${fixTitle} cleared the visible network break.`,
      detail:
        "Aegis reran the timeline after the repair and the connection path now completes without a failed stage."
    };
  }

  if (status === "improved") {
    return {
      summary: `${fixTitle} improved the connection chain, but follow-up is still needed.`,
      detail:
        "The verification scan found progress after the repair, but at least one issue remains in the timeline."
    };
  }

  if (status === "worse") {
    return {
      summary: `${fixTitle} changed the network state, but the latest scan looks worse.`,
      detail:
        "Aegis detected a broader or more severe failure path after the repair. Review the new failure point before trying a stronger fix."
    };
  }

  return {
    summary: `${fixTitle} did not change the observed failure path.`,
    detail:
      "The verification scan still shows the same issue chain, so the next safest recommendation should be reviewed before escalating."
  };
}

export function buildRepairBlockedVerification(
  beforeScan: ScanResult,
  fixResult: FixExecutionResult
): RepairVerification {
  return {
    id: `${fixResult.fixId}-${Date.now()}`,
    fixId: fixResult.fixId,
    fixTitle: fixResult.title,
    status: "blocked",
    verifiedAt: new Date().toISOString(),
    beforeScanId: beforeScan.id,
    beforeDiagnosis: beforeScan.diagnosis.title,
    summary: `${fixResult.title} was not applied.`,
    detail: fixResult.message,
    changedNodes: []
  };
}

export function buildRepairVerification(
  beforeScan: ScanResult,
  afterScan: ScanResult,
  fixResult: FixExecutionResult
): RepairVerification {
  const changedNodes = collectNodeTransitions(beforeScan, afterScan);
  const status = resolveVerificationStatus(beforeScan, afterScan, changedNodes);
  const message = buildSummary(fixResult.title, status);

  return {
    id: `${fixResult.fixId}-${afterScan.id}`,
    fixId: fixResult.fixId,
    fixTitle: fixResult.title,
    status,
    verifiedAt: afterScan.createdAt,
    beforeScanId: beforeScan.id,
    afterScanId: afterScan.id,
    beforeDiagnosis: beforeScan.diagnosis.title,
    afterDiagnosis: afterScan.diagnosis.title,
    summary: message.summary,
    detail: message.detail,
    changedNodes
  };
}
