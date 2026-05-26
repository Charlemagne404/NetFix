use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticStatus {
    Ok,
    Warning,
    Failed,
    Unknown,
    Skipped,
    Pending,
    Running,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FixSafety {
    Safe,
    Moderate,
    Aggressive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceItem {
    pub id: String,
    pub label: String,
    pub value: String,
    pub status: DiagnosticStatus,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixAction {
    pub id: String,
    pub title: String,
    pub description: String,
    pub safety: FixSafety,
    pub requires_admin: bool,
    pub commands_preview: Option<Vec<String>>,
    pub estimated_impact: String,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticNode {
    pub id: String,
    pub label: String,
    pub technical_label: Option<String>,
    pub icon: String,
    pub status: DiagnosticStatus,
    pub severity: Severity,
    pub summary: String,
    pub explanation: String,
    pub checks: Vec<String>,
    pub evidence: Vec<EvidenceItem>,
    pub likely_causes: Vec<String>,
    pub recommended_fixes: Vec<FixAction>,
    pub raw_output: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverallDiagnosis {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub confidence: u8,
    pub severity: Severity,
    pub primary_failed_node_id: Option<String>,
    pub recommended_fixes: Vec<FixAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Environment {
    pub os: String,
    pub hostname: Option<String>,
    pub app_version: String,
    pub is_admin: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentInfo {
    pub os: String,
    pub hostname: Option<String>,
    pub app_version: String,
    pub is_admin: Option<bool>,
    pub is_windows: bool,
    pub is_tauri: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub id: String,
    pub created_at: String,
    pub mode: String,
    pub overall_status: DiagnosticStatus,
    pub diagnosis: OverallDiagnosis,
    pub nodes: Vec<DiagnosticNode>,
    pub environment: Environment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixExecutionResult {
    pub fix_id: String,
    pub status: String,
    pub title: String,
    pub message: String,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub requires_admin: Option<bool>,
}

#[derive(Debug)]
struct CommandOutput {
    stdout: String,
    stderr: String,
    success: bool,
}

fn now_id() -> String {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("real-{millis}")
}

fn now_iso() -> String {
    let now = time::OffsetDateTime::now_utc();
    now.format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn evidence(
    id: &str,
    label: &str,
    value: &str,
    status: DiagnosticStatus,
    detail: Option<&str>,
) -> EvidenceItem {
    EvidenceItem {
        id: id.to_string(),
        label: label.to_string(),
        value: value.to_string(),
        status,
        detail: detail.map(str::to_string),
    }
}

fn fix_action(id: &str) -> FixAction {
    match id {
        "flush-dns" => FixAction {
            id: id.to_string(),
            title: "Flush DNS cache".to_string(),
            description: "Clears stale local DNS entries.".to_string(),
            safety: FixSafety::Safe,
            requires_admin: false,
            commands_preview: Some(vec!["ipconfig /flushdns".to_string()]),
            estimated_impact: "No connection reset.".to_string(),
            warning: None,
        },
        "renew-dhcp" => FixAction {
            id: id.to_string(),
            title: "Renew DHCP lease".to_string(),
            description: "Requests a fresh IP configuration from DHCP.".to_string(),
            safety: FixSafety::Safe,
            requires_admin: false,
            commands_preview: Some(vec!["ipconfig /release".to_string(), "ipconfig /renew".to_string()]),
            estimated_impact: "Connection may drop briefly.".to_string(),
            warning: None,
        },
        "restart-wlan-service" => FixAction {
            id: id.to_string(),
            title: "Restart WLAN AutoConfig".to_string(),
            description: "Restarts the Windows Wi-Fi management service.".to_string(),
            safety: FixSafety::Safe,
            requires_admin: true,
            commands_preview: Some(vec!["Restart-Service WlanSvc".to_string()]),
            estimated_impact: "Wi-Fi may disconnect briefly.".to_string(),
            warning: None,
        },
        "generate-wlan-report" => FixAction {
            id: id.to_string(),
            title: "Generate WLAN report".to_string(),
            description: "Creates the built-in Windows WLAN report.".to_string(),
            safety: FixSafety::Safe,
            requires_admin: false,
            commands_preview: Some(vec!["netsh wlan show wlanreport".to_string()]),
            estimated_impact: "Read-only report generation.".to_string(),
            warning: None,
        },
        _ => FixAction {
            id: "open-network-settings".to_string(),
            title: "Open Network Settings".to_string(),
            description: "Opens Windows network settings.".to_string(),
            safety: FixSafety::Safe,
            requires_admin: false,
            commands_preview: Some(vec!["start ms-settings:network".to_string()]),
            estimated_impact: "No settings are changed automatically.".to_string(),
            warning: None,
        },
    }
}

fn node(
    id: &str,
    label: &str,
    icon: &str,
    status: DiagnosticStatus,
    summary: &str,
    explanation: &str,
    checks: Vec<&str>,
    evidence_items: Vec<EvidenceItem>,
    fixes: Vec<FixAction>,
    raw_output: Option<String>,
) -> DiagnosticNode {
    let severity = match status {
        DiagnosticStatus::Failed => Severity::High,
        DiagnosticStatus::Warning => Severity::Medium,
        DiagnosticStatus::Unknown | DiagnosticStatus::Skipped => Severity::Low,
        _ => Severity::Info,
    };

    DiagnosticNode {
        id: id.to_string(),
        label: label.to_string(),
        technical_label: None,
        icon: icon.to_string(),
        status,
        severity,
        summary: summary.to_string(),
        explanation: explanation.to_string(),
        checks: checks.into_iter().map(str::to_string).collect(),
        evidence: evidence_items,
        likely_causes: Vec::new(),
        recommended_fixes: fixes,
        raw_output,
    }
}

fn run_process(program: &str, args: &[&str], timeout: Duration) -> Result<CommandOutput, Box<dyn Error>> {
    let mut child = Command::new(program)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let start = Instant::now();
    loop {
        if child.try_wait()?.is_some() {
            let output = child.wait_with_output()?;
            return Ok(CommandOutput {
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                success: output.status.success(),
            });
        }

        if start.elapsed() > timeout {
            let _ = child.kill();
            let output = child.wait_with_output()?;
            return Ok(CommandOutput {
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: "Command timed out".to_string(),
                success: false,
            });
        }

        thread::sleep(Duration::from_millis(50));
    }
}

fn powershell(command: &str) -> Result<CommandOutput, Box<dyn Error>> {
    run_process(
        "powershell.exe",
        &["-NoProfile", "-NonInteractive", "-Command", command],
        Duration::from_secs(8),
    )
}

fn simple_mock_scan() -> ScanResult {
    let nodes = vec![
        node(
            "device",
            "Device",
            "monitor",
            DiagnosticStatus::Ok,
            "Device networking can be queried.",
            "The backend is not running on Windows, so Aegis returns demo diagnostics.",
            vec!["OS detected", "Network stack accessible"],
            vec![evidence("os", "Operating system", std::env::consts::OS, DiagnosticStatus::Ok, None)],
            vec![],
            None,
        ),
        node(
            "adapter",
            "Adapter",
            "network",
            DiagnosticStatus::Skipped,
            "Real Windows adapter checks are unavailable here.",
            "Use the Windows Tauri build for adapter checks.",
            vec!["Adapter detected", "Driver checked"],
            vec![evidence("platform", "Platform", "Non-Windows fallback", DiagnosticStatus::Unknown, None)],
            vec![],
            None,
        ),
    ];

    ScanResult {
        id: now_id(),
        created_at: now_iso(),
        mode: "mock".to_string(),
        overall_status: DiagnosticStatus::Warning,
        diagnosis: OverallDiagnosis {
            id: "non-windows-fallback".to_string(),
            title: "Demo mode active".to_string(),
            summary: "Real Windows diagnostics are not available on this platform. The frontend mock scenarios remain fully usable.".to_string(),
            confidence: 100,
            severity: Severity::Info,
            primary_failed_node_id: None,
            recommended_fixes: vec![],
        },
        nodes,
        environment: Environment {
            os: std::env::consts::OS.to_string(),
            hostname: hostname(),
            app_version: "0.1.0".to_string(),
            is_admin: Some(false),
        },
    }
}

fn hostname() -> Option<String> {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
}

pub fn run_windows_scan(_scenario_id: Option<String>) -> Result<ScanResult, Box<dyn Error>> {
    if !cfg!(target_os = "windows") {
        return Ok(simple_mock_scan());
    }

    let adapter_out = powershell("Get-NetAdapter | Select-Object Name,InterfaceDescription,Status,NdisPhysicalMedium | ConvertTo-Json -Depth 3")?;
    let wlan_out = powershell("Get-Service WlanSvc | Select-Object Name,Status | ConvertTo-Json")?;
    let wifi_out = powershell("netsh wlan show interfaces")?;
    let ip_out = powershell("ipconfig /all")?;
    let gateway_out = powershell("(Get-NetIPConfiguration | Select-Object -First 1 IPv4DefaultGateway | ConvertTo-Json -Depth 4)")?;
    let internet_out = powershell("Test-NetConnection 1.1.1.1 -InformationLevel Quiet")?;
    let dns_out = powershell("try { Resolve-DnsName google.com -ErrorAction Stop | Select-Object -First 1 | ConvertTo-Json -Depth 3 } catch { $_.Exception.Message; exit 1 }")?;
    let windows_out = powershell("Get-NetConnectionProfile | Select-Object -First 1 Name,NetworkCategory,IPv4Connectivity | ConvertTo-Json -Depth 3; netsh winhttp show proxy")?;
    let apps_out = powershell("Test-NetConnection www.microsoft.com -Port 443 -InformationLevel Quiet")?;

    let adapter_ok = adapter_out.stdout.to_lowercase().contains("up")
        && adapter_out.stdout.to_lowercase().contains("wireless");
    let wlan_ok = wlan_out.stdout.to_lowercase().contains("running");
    let wifi_connected = wifi_out.stdout.to_lowercase().contains("connected");
    let ip_valid = !ip_out.stdout.contains("169.254.") && ip_out.stdout.to_lowercase().contains("ipv4");
    let gateway_present = gateway_out.stdout.to_lowercase().contains("nexthop")
        || ip_out.stdout.to_lowercase().contains("default gateway");
    let internet_ok = internet_out.stdout.trim().eq_ignore_ascii_case("true") && internet_out.success;
    let dns_ok = dns_out.success;
    let apps_ok = apps_out.stdout.trim().eq_ignore_ascii_case("true") && apps_out.success;

    let mut nodes = vec![
        node(
            "device",
            "Device",
            "monitor",
            DiagnosticStatus::Ok,
            "Windows diagnostics are available.",
            "Aegis can run read-only Windows networking checks.",
            vec!["OS detected", "Network stack accessible"],
            vec![evidence("os", "Operating system", "Windows", DiagnosticStatus::Ok, None)],
            vec![],
            None,
        ),
        node(
            "adapter",
            "Adapter",
            "network",
            if adapter_ok { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed },
            if adapter_ok { "A Wi-Fi adapter appears enabled." } else { "No enabled wireless adapter was found." },
            "Windows adapter inventory was queried with Get-NetAdapter.",
            vec!["Adapters detected", "Wi-Fi adapter present", "Adapter enabled"],
            vec![evidence("adapter", "Adapter output", if adapter_ok { "Wireless adapter found" } else { "Wireless adapter not confirmed" }, if adapter_ok { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed }, None)],
            if adapter_ok { vec![] } else { vec![fix_action("open-network-settings"), fix_action("generate-wlan-report")] },
            Some(adapter_out.stdout),
        ),
        node(
            "wifi",
            "Wi-Fi",
            "wifi",
            if wlan_ok && wifi_connected { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed },
            if wlan_ok && wifi_connected { "Wi-Fi service and connection are active." } else { "Wi-Fi service or connection is not active." },
            "Aegis checked WLAN AutoConfig and current wireless interface state.",
            vec!["WLAN AutoConfig running", "Interface connected"],
            vec![
                evidence("service", "WlanSvc", if wlan_ok { "Running" } else { "Stopped or unavailable" }, if wlan_ok { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed }, None),
                evidence("interface", "Interface", if wifi_connected { "Connected" } else { "Not connected" }, if wifi_connected { DiagnosticStatus::Ok } else { DiagnosticStatus::Warning }, None),
            ],
            if wlan_ok { vec![] } else { vec![fix_action("restart-wlan-service")] },
            Some(format!("{}\n{}", wlan_out.stdout, wifi_out.stdout)),
        ),
        node(
            "profile",
            "Profile",
            "id-card",
            if wifi_connected { DiagnosticStatus::Ok } else { DiagnosticStatus::Skipped },
            if wifi_connected { "Current Wi-Fi profile is present." } else { "Profile check skipped until Wi-Fi connects." },
            "Aegis does not request saved Wi-Fi passwords.",
            vec!["Current SSID detected", "Profile exists"],
            vec![evidence("profile", "Profile", if wifi_connected { "Current SSID detected" } else { "Unavailable" }, if wifi_connected { DiagnosticStatus::Ok } else { DiagnosticStatus::Unknown }, Some("Saved password content is never requested."))],
            vec![],
            Some(wifi_out.stdout.clone()),
        ),
        node(
            "ip",
            "IP Address",
            "binary",
            if ip_valid { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed },
            if ip_valid { "Windows has a non-APIPA IPv4 address." } else { "Windows does not have a valid IPv4 address." },
            "Aegis reviewed ipconfig output for IPv4 and APIPA symptoms.",
            vec!["IPv4 exists", "APIPA avoided", "DHCP information checked"],
            vec![evidence("ipv4", "IPv4", if ip_valid { "Valid IPv4 detected" } else { "Missing or APIPA" }, if ip_valid { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed }, None)],
            if ip_valid { vec![] } else { vec![fix_action("renew-dhcp")] },
            Some(ip_out.stdout),
        ),
        node(
            "gateway",
            "Gateway",
            "router",
            if gateway_present { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed },
            if gateway_present { "A default gateway is configured." } else { "No default gateway was confirmed." },
            "Aegis checked default gateway configuration.",
            vec!["Default gateway exists", "Route exists"],
            vec![evidence("gateway", "Default gateway", if gateway_present { "Present" } else { "Missing" }, if gateway_present { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed }, None)],
            if gateway_present { vec![] } else { vec![fix_action("renew-dhcp")] },
            Some(gateway_out.stdout),
        ),
        node(
            "internet",
            "Internet",
            "globe",
            if internet_ok { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed },
            if internet_ok { "External IP connectivity works." } else { "External IP connectivity failed." },
            "Aegis tested a known external IP endpoint.",
            vec!["1.1.1.1 connectivity"],
            vec![evidence("cloudflare", "1.1.1.1", if internet_ok { "Reachable" } else { "Unreachable" }, if internet_ok { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed }, None)],
            if internet_ok { vec![] } else { vec![fix_action("renew-dhcp"), fix_action("generate-wlan-report")] },
            Some(internet_out.stdout),
        ),
        node(
            "dns",
            "DNS",
            "search-check",
            if dns_ok { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed },
            if dns_ok { "Domain name resolution works." } else { "Domain name resolution failed." },
            "Aegis resolved google.com without collecting browsing data.",
            vec!["DNS server configured", "google.com resolves"],
            vec![evidence("google", "google.com", if dns_ok { "Resolved" } else { "Failed" }, if dns_ok { DiagnosticStatus::Ok } else { DiagnosticStatus::Failed }, None)],
            if dns_ok { vec![] } else { vec![fix_action("flush-dns"), fix_action("renew-dhcp")] },
            Some(format!("{}\n{}", dns_out.stdout, dns_out.stderr)),
        ),
        node(
            "windows",
            "Windows Status",
            "badge-check",
            DiagnosticStatus::Ok,
            "Windows network status was collected.",
            "Aegis collected Windows connection profile and proxy output.",
            vec!["Connection profile checked", "WinHTTP proxy checked"],
            vec![evidence("profile", "Profile/proxy", "Collected", DiagnosticStatus::Ok, None)],
            vec![],
            Some(windows_out.stdout),
        ),
        node(
            "apps",
            "Apps",
            "app-window",
            if apps_ok { DiagnosticStatus::Ok } else { DiagnosticStatus::Warning },
            if apps_ok { "HTTPS app-layer connectivity works." } else { "HTTPS app-layer check did not pass." },
            "Aegis tested HTTPS reachability to a known Microsoft endpoint.",
            vec!["HTTPS 443 tested"],
            vec![evidence("https", "HTTPS 443", if apps_ok { "Reachable" } else { "Not confirmed" }, if apps_ok { DiagnosticStatus::Ok } else { DiagnosticStatus::Warning }, None)],
            vec![],
            Some(apps_out.stdout),
        ),
    ];

    let primary_failed_node_id = nodes.iter().find(|node| matches!(node.status, DiagnosticStatus::Failed)).map(|node| node.id.clone());
    let overall_status = if primary_failed_node_id.is_some() { DiagnosticStatus::Failed } else if nodes.iter().any(|node| matches!(node.status, DiagnosticStatus::Warning)) { DiagnosticStatus::Warning } else { DiagnosticStatus::Ok };
    let (title, summary, confidence, recommended_fixes) = if !internet_ok && gateway_present {
        ("Router works, but the internet is unreachable", "The router appears configured, but external IP connectivity failed.", 82, vec![fix_action("renew-dhcp"), fix_action("generate-wlan-report")])
    } else if !dns_ok && internet_ok {
        ("Connected, but DNS is failing", "External IP connectivity works, but domain name lookups failed.", 90, vec![fix_action("flush-dns"), fix_action("renew-dhcp")])
    } else if !ip_valid {
        ("Connected to Wi-Fi, but no valid IP address", "Windows did not report a usable IPv4 configuration.", 88, vec![fix_action("renew-dhcp")])
    } else if !adapter_ok {
        ("No usable Wi-Fi adapter detected", "Windows did not report an enabled wireless adapter.", 90, vec![fix_action("open-network-settings")])
    } else if !wlan_ok {
        ("Windows Wi-Fi service is not running", "WLAN AutoConfig is stopped or unavailable.", 90, vec![fix_action("restart-wlan-service")])
    } else if apps_ok {
        ("Everything looks good", "The full connection chain passed the implemented read-only checks.", 92, vec![])
    } else {
        ("Network path is degraded", "Aegis found a problem in the connection chain.", 68, vec![fix_action("generate-wlan-report")])
    };

    for node_item in nodes.iter_mut() {
        if matches!(node_item.status, DiagnosticStatus::Failed) && node_item.likely_causes.is_empty() {
            node_item.likely_causes.push("Review the evidence for this failure point.".to_string());
        }
    }

    Ok(ScanResult {
        id: now_id(),
        created_at: now_iso(),
        mode: "real".to_string(),
        overall_status,
        diagnosis: OverallDiagnosis {
            id: title.to_lowercase().replace(' ', "-"),
            title: title.to_string(),
            summary: summary.to_string(),
            confidence,
            severity: if primary_failed_node_id.is_some() { Severity::High } else { Severity::Info },
            primary_failed_node_id,
            recommended_fixes,
        },
        nodes,
        environment: Environment {
            os: "Windows".to_string(),
            hostname: hostname(),
            app_version: "0.1.0".to_string(),
            is_admin: Some(false),
        },
    })
}

pub fn run_allowlisted_fix(fix_id: &str) -> Result<FixExecutionResult, Box<dyn Error>> {
    if !cfg!(target_os = "windows") {
        return Ok(FixExecutionResult {
            fix_id: fix_id.to_string(),
            status: "blocked".to_string(),
            title: "Fix unavailable".to_string(),
            message: "Real fixes are only available in the Windows Tauri build.".to_string(),
            stdout: None,
            stderr: None,
            requires_admin: Some(false),
        });
    }

    let commands: Vec<(&str, Vec<&str>)> = match fix_id {
        "flush-dns" => vec![("ipconfig.exe", vec!["/flushdns"])],
        "renew-dhcp" => vec![
            ("ipconfig.exe", vec!["/release"]),
            ("ipconfig.exe", vec!["/renew"]),
        ],
        "restart-wlan-service" => vec![(
            "powershell.exe",
            vec!["-NoProfile", "-NonInteractive", "-Command", "Restart-Service WlanSvc"],
        )],
        "generate-wlan-report" => vec![("netsh.exe", vec!["wlan", "show", "wlanreport"])],
        "open-network-settings" => vec![(
            "powershell.exe",
            vec!["-NoProfile", "-NonInteractive", "-Command", "Start-Process ms-settings:network"],
        )],
        "restart-adapter" | "forget-current-profile" | "dns-automatic" | "set-public-dns"
        | "winsock-reset" | "tcpip-reset" | "full-network-reset-settings" => {
            return Ok(FixExecutionResult {
                fix_id: fix_id.to_string(),
                status: "blocked".to_string(),
                title: "Advanced fix blocked in v0.1".to_string(),
                message: "This fix is registered and previewed, but execution is intentionally disabled until adapter/SSID selection and confirmation flows are validated on Windows.".to_string(),
                stdout: None,
                stderr: None,
                requires_admin: Some(true),
            });
        }
        _ => {
            return Ok(FixExecutionResult {
                fix_id: fix_id.to_string(),
                status: "blocked".to_string(),
                title: "Unknown fix".to_string(),
                message: "The requested fix ID is not in the backend allowlist.".to_string(),
                stdout: None,
                stderr: None,
                requires_admin: Some(false),
            });
        }
    };

    let mut stdout = String::new();
    let mut stderr = String::new();
    let mut success = true;

    for (program, args) in commands {
        let output = run_process(program, &args, Duration::from_secs(18))?;
        stdout.push_str(&output.stdout);
        stderr.push_str(&output.stderr);
        success = success && output.success;
    }

    Ok(FixExecutionResult {
        fix_id: fix_id.to_string(),
        status: if success { "success" } else { "failed" }.to_string(),
        title: fix_action(fix_id).title,
        message: if success {
            "Allowlisted fix completed.".to_string()
        } else {
            "Allowlisted fix finished with errors. Review stderr.".to_string()
        },
        stdout: Some(stdout),
        stderr: if stderr.is_empty() { None } else { Some(stderr) },
        requires_admin: Some(fix_action(fix_id).requires_admin),
    })
}

pub fn generate_wlan_report_impl() -> Result<FixExecutionResult, Box<dyn Error>> {
    run_allowlisted_fix("generate-wlan-report")
}

pub fn export_local_report(format: &str, content: &str) -> Result<String, Box<dyn Error>> {
    let extension = match format {
        "json" => "json",
        "html" => "html",
        _ => "txt",
    };
    let directory = std::env::temp_dir().join("Aegis Network Doctor");
    fs::create_dir_all(&directory)?;
    let path = directory.join(format!("aegis-network-report-{}.{}", now_id(), extension));
    fs::write(&path, content)?;
    Ok(path.to_string_lossy().to_string())
}

pub fn environment_info() -> EnvironmentInfo {
    EnvironmentInfo {
        os: std::env::consts::OS.to_string(),
        hostname: hostname(),
        app_version: "0.1.0".to_string(),
        is_admin: Some(false),
        is_windows: cfg!(target_os = "windows"),
        is_tauri: true,
    }
}
