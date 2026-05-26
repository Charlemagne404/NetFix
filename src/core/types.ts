export type DiagnosticStatus =
  | "ok"
  | "warning"
  | "failed"
  | "unknown"
  | "skipped"
  | "pending"
  | "running";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type FixSafety = "safe" | "moderate" | "aggressive";

export type AppMode = "normal" | "technician";

export type ThemeMode = "system" | "dark" | "light";

export type MockScenarioId =
  | "healthy"
  | "dns-failure"
  | "dhcp-apipa"
  | "no-adapter"
  | "wlan-service-stopped"
  | "gateway-unreachable"
  | "internet-unreachable"
  | "proxy-app-issue"
  | "windows-false-negative"
  | "captive-portal";

export type EvidenceItem = {
  id: string;
  label: string;
  value: string;
  status: DiagnosticStatus;
  detail?: string;
};

export type FixAction = {
  id: string;
  title: string;
  description: string;
  safety: FixSafety;
  requiresAdmin: boolean;
  commandsPreview?: string[];
  estimatedImpact: string;
  warning?: string;
};

export type DiagnosticNode = {
  id: string;
  label: string;
  technicalLabel?: string;
  icon: string;
  status: DiagnosticStatus;
  severity: Severity;
  summary: string;
  explanation: string;
  checks: string[];
  evidence: EvidenceItem[];
  likelyCauses: string[];
  recommendedFixes: FixAction[];
  rawOutput?: string;
  startedAt?: string;
  completedAt?: string;
};

export type OverallDiagnosis = {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  severity: Severity;
  primaryFailedNodeId?: string;
  recommendedFixes: FixAction[];
};

export type ScanResult = {
  id: string;
  createdAt: string;
  mode: "mock" | "real";
  overallStatus: DiagnosticStatus;
  diagnosis: OverallDiagnosis;
  nodes: DiagnosticNode[];
  environment: {
    os: string;
    hostname?: string;
    appVersion: string;
    isAdmin?: boolean;
  };
};

export type FixExecutionResult = {
  fixId: string;
  status: "success" | "failed" | "blocked" | "simulated";
  title: string;
  message: string;
  stdout?: string;
  stderr?: string;
  requiresAdmin?: boolean;
};

export type EnvironmentInfo = ScanResult["environment"] & {
  isWindows: boolean;
  isTauri: boolean;
};
