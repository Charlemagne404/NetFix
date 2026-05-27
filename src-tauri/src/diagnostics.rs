use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::fs;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixConfirmation {
    pub acknowledged: bool,
    pub typed_phrase: Option<String>,
}

#[derive(Debug)]
struct CommandOutput {
    stdout: String,
    stderr: String,
    success: bool,
}

#[derive(Debug, Clone, Default)]
struct AdapterFact {
    name: String,
    description: Option<String>,
    status: String,
    interface_index: Option<i64>,
    physical_medium: Option<String>,
    mac_address: Option<String>,
    link_speed: Option<String>,
    hardware_interface: bool,
}

#[derive(Debug, Clone, Default)]
struct WifiFact {
    name: Option<String>,
    description: Option<String>,
    state: Option<String>,
    ssid: Option<String>,
    bssid: Option<String>,
    signal: Option<String>,
    radio_type: Option<String>,
    authentication: Option<String>,
    profile: Option<String>,
    channel: Option<String>,
    receive_rate: Option<String>,
    transmit_rate: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct IpFact {
    interface_alias: Option<String>,
    interface_index: Option<i64>,
    ipv4_address: Option<String>,
    prefix_length: Option<String>,
    gateway: Option<String>,
    dns_servers: Vec<String>,
    profile_name: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct IpInterfaceFact {
    interface_alias: Option<String>,
    interface_index: Option<i64>,
    dhcp: Option<String>,
    connection_state: Option<String>,
    interface_metric: Option<i64>,
}

#[derive(Debug, Clone, Default)]
struct WindowsProfileFact {
    name: Option<String>,
    interface_alias: Option<String>,
    interface_index: Option<i64>,
    network_category: Option<String>,
    ipv4_connectivity: Option<String>,
    ipv6_connectivity: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct ProxyFact {
    winhttp_mode: String,
    winhttp_server: Option<String>,
    winhttp_bypass: Option<String>,
    user_proxy_enabled: bool,
    user_proxy_server: Option<String>,
    auto_config_url: Option<String>,
    auto_detect: bool,
}

#[derive(Debug, Clone, Default)]
struct ServiceFact {
    name: String,
    status: String,
    start_type: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct RouteFact {
    interface_alias: Option<String>,
    interface_index: Option<i64>,
    destination_prefix: Option<String>,
    next_hop: Option<String>,
    route_metric: Option<i64>,
    state: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct EndpointFact {
    computer_name: Option<String>,
    remote_address: Option<String>,
    remote_port: Option<String>,
    tcp_succeeded: bool,
    ping_succeeded: bool,
    interface_alias: Option<String>,
    source_address: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct HttpProbeFact {
    success: bool,
    status_code: Option<i64>,
    final_uri: Option<String>,
    location: Option<String>,
    snippet: Option<String>,
    error: Option<String>,
}

const AGGRESSIVE_CONFIRMATION_PHRASE: &str = "RESET";

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

fn fix_action(id: &str) -> Option<FixAction> {
    match id {
        "flush-dns" => Some(FixAction {
            id: id.to_string(),
            title: "Flush DNS cache".to_string(),
            description: "Clears stale local DNS entries.".to_string(),
            safety: FixSafety::Safe,
            requires_admin: false,
            commands_preview: Some(vec!["ipconfig /flushdns".to_string()]),
            estimated_impact: "No connection reset.".to_string(),
            warning: None,
        }),
        "renew-dhcp" => Some(FixAction {
            id: id.to_string(),
            title: "Renew DHCP lease".to_string(),
            description: "Requests a fresh IP configuration from DHCP.".to_string(),
            safety: FixSafety::Safe,
            requires_admin: false,
            commands_preview: Some(vec![
                "ipconfig /release".to_string(),
                "ipconfig /renew".to_string(),
            ]),
            estimated_impact: "Connection may drop briefly.".to_string(),
            warning: None,
        }),
        "restart-wlan-service" => Some(FixAction {
            id: id.to_string(),
            title: "Restart WLAN AutoConfig".to_string(),
            description: "Restarts the Windows Wi-Fi management service.".to_string(),
            safety: FixSafety::Safe,
            requires_admin: true,
            commands_preview: Some(vec!["Restart-Service WlanSvc".to_string()]),
            estimated_impact: "Wi-Fi may disconnect briefly.".to_string(),
            warning: None,
        }),
        "generate-wlan-report" => Some(FixAction {
            id: id.to_string(),
            title: "Generate WLAN report".to_string(),
            description: "Creates the built-in Windows WLAN report.".to_string(),
            safety: FixSafety::Safe,
            requires_admin: false,
            commands_preview: Some(vec!["netsh wlan show wlanreport".to_string()]),
            estimated_impact: "Read-only report generation.".to_string(),
            warning: None,
        }),
        "open-network-settings" => Some(FixAction {
            id: id.to_string(),
            title: "Open Network Settings".to_string(),
            description: "Opens Windows network settings.".to_string(),
            safety: FixSafety::Safe,
            requires_admin: false,
            commands_preview: Some(vec!["start ms-settings:network".to_string()]),
            estimated_impact: "No settings are changed automatically.".to_string(),
            warning: None,
        }),
        "restart-adapter" => Some(FixAction {
            id: id.to_string(),
            title: "Restart selected adapter".to_string(),
            description:
                "Disables and re-enables the active network adapter to recover a stuck interface."
                    .to_string(),
            safety: FixSafety::Moderate,
            requires_admin: true,
            commands_preview: Some(vec![
                "Disable-NetAdapter -Name \"<adapter>\" -Confirm:$false".to_string(),
                "Enable-NetAdapter -Name \"<adapter>\" -Confirm:$false".to_string(),
            ]),
            estimated_impact: "The network connection will drop briefly.".to_string(),
            warning: Some(
                "Use only after safer fixes fail. This interrupts active downloads, calls, and remote sessions."
                    .to_string(),
            ),
        }),
        "forget-current-profile" => Some(FixAction {
            id: id.to_string(),
            title: "Forget current Wi-Fi profile".to_string(),
            description:
                "Deletes the saved Wi-Fi profile so Windows can reconnect from a clean profile."
                    .to_string(),
            safety: FixSafety::Moderate,
            requires_admin: false,
            commands_preview: Some(vec![
                "netsh wlan delete profile name=\"<SSID>\"".to_string(),
            ]),
            estimated_impact: "You will need the Wi-Fi password to reconnect.".to_string(),
            warning: Some(
                "Aegis never reads or exports saved Wi-Fi passwords. Make sure you know the password first."
                    .to_string(),
            ),
        }),
        "dns-automatic" => Some(FixAction {
            id: id.to_string(),
            title: "Reset DNS to automatic".to_string(),
            description:
                "Returns the adapter to DNS servers provided by DHCP instead of manually configured DNS."
                    .to_string(),
            safety: FixSafety::Moderate,
            requires_admin: true,
            commands_preview: Some(vec![
                "Set-DnsClientServerAddress -InterfaceAlias \"<adapter>\" -ResetServerAddresses"
                    .to_string(),
            ]),
            estimated_impact: "Name resolution may change immediately.".to_string(),
            warning: Some(
                "This changes adapter DNS settings. Review the command preview before applying."
                    .to_string(),
            ),
        }),
        "set-public-dns" => Some(FixAction {
            id: id.to_string(),
            title: "Temporarily set public DNS".to_string(),
            description:
                "Sets DNS to Cloudflare and Google public resolvers for the active adapter."
                    .to_string(),
            safety: FixSafety::Moderate,
            requires_admin: true,
            commands_preview: Some(vec![
                "Set-DnsClientServerAddress -InterfaceAlias \"<adapter>\" -ServerAddresses 1.1.1.1,8.8.8.8"
                    .to_string(),
            ]),
            estimated_impact: "Changes DNS behavior until reverted.".to_string(),
            warning: Some(
                "Only use this when your current DNS server is confirmed broken or unreachable."
                    .to_string(),
            ),
        }),
        "winsock-reset" => Some(FixAction {
            id: id.to_string(),
            title: "Winsock reset".to_string(),
            description:
                "Resets the Windows network socket catalog. This is a last-resort repair."
                    .to_string(),
            safety: FixSafety::Aggressive,
            requires_admin: true,
            commands_preview: Some(vec!["netsh winsock reset".to_string()]),
            estimated_impact: "A restart is usually required.".to_string(),
            warning: Some(
                "This can disrupt VPN, security, and proxy software. Aegis will never run it automatically."
                    .to_string(),
            ),
        }),
        "tcpip-reset" => Some(FixAction {
            id: id.to_string(),
            title: "TCP/IP reset".to_string(),
            description:
                "Resets core Windows TCP/IP configuration. This is an advanced last-resort fix."
                    .to_string(),
            safety: FixSafety::Aggressive,
            requires_admin: true,
            commands_preview: Some(vec!["netsh int ip reset".to_string()]),
            estimated_impact:
                "A restart is usually required and custom IP settings may be lost.".to_string(),
            warning: Some(
                "Review adapter settings first. This should only be used after targeted fixes fail."
                    .to_string(),
            ),
        }),
        "full-network-reset-settings" => Some(FixAction {
            id: id.to_string(),
            title: "Open full network reset".to_string(),
            description:
                "Opens the Windows network reset settings page without running the reset for you."
                    .to_string(),
            safety: FixSafety::Aggressive,
            requires_admin: true,
            commands_preview: Some(vec!["start ms-settings:network-status".to_string()]),
            estimated_impact:
                "No reset is performed by Aegis. Windows will show its own final confirmation."
                    .to_string(),
            warning: Some(
                "Full network reset is a last resort and may remove adapters, VPNs, and saved networking configuration."
                    .to_string(),
            ),
        }),
        _ => None,
    }
}

fn known_fix_action(id: &str) -> FixAction {
    fix_action(id).expect("fix registry entry should exist")
}

fn blocked_fix_result(
    fix_id: &str,
    title: &str,
    message: &str,
    requires_admin: bool,
) -> FixExecutionResult {
    FixExecutionResult {
        fix_id: fix_id.to_string(),
        status: "blocked".to_string(),
        title: title.to_string(),
        message: message.to_string(),
        stdout: None,
        stderr: None,
        requires_admin: Some(requires_admin),
    }
}

fn validate_fix_confirmation(
    fix: &FixAction,
    confirmation: Option<&FixConfirmation>,
) -> Option<FixExecutionResult> {
    match fix.safety {
        FixSafety::Safe => None,
        FixSafety::Moderate => {
            if confirmation.is_some_and(|value| value.acknowledged) {
                None
            } else {
                Some(blocked_fix_result(
                    &fix.id,
                    "Confirmation required",
                    "This moderate fix requires an explicit confirmation step before Aegis will run it.",
                    fix.requires_admin,
                ))
            }
        }
        FixSafety::Aggressive => {
            if !confirmation.is_some_and(|value| value.acknowledged) {
                Some(blocked_fix_result(
                    &fix.id,
                    "Confirmation required",
                    "This aggressive fix requires an explicit confirmation step before Aegis will run it.",
                    fix.requires_admin,
                ))
            } else if confirmation.and_then(|value| value.typed_phrase.as_deref())
                != Some(AGGRESSIVE_CONFIRMATION_PHRASE)
            {
                Some(blocked_fix_result(
                    &fix.id,
                    "Typed confirmation required",
                    "This aggressive fix is locked until the exact confirmation phrase is provided.",
                    fix.requires_admin,
                ))
            } else {
                None
            }
        }
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

fn hostname() -> Option<String> {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
}

fn current_process_is_admin() -> bool {
    if !cfg!(target_os = "windows") {
        return false;
    }

    powershell(
        "[bool](([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))",
    )
    .map(|output| output.stdout.trim().eq_ignore_ascii_case("true"))
    .unwrap_or(false)
}

fn parse_json(stdout: &str) -> Option<Value> {
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        None
    } else {
        serde_json::from_str(trimmed).ok()
    }
}

fn parse_json_list(stdout: &str) -> Vec<Value> {
    match parse_json(stdout) {
        Some(Value::Array(items)) => items,
        Some(Value::Null) | None => Vec::new(),
        Some(item) => vec![item],
    }
}

fn get_string(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(value_to_string)
}

fn get_bool(value: &Value, key: &str) -> Option<bool> {
    value.get(key).and_then(value_to_bool)
}

fn get_i64(value: &Value, key: &str) -> Option<i64> {
    value.get(key).and_then(value_to_i64)
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(boolean) => Some(boolean.to_string()),
        _ => None,
    }
}

fn value_to_bool(value: &Value) -> Option<bool> {
    match value {
        Value::Bool(boolean) => Some(*boolean),
        Value::Number(number) => number.as_i64().map(|value| value != 0),
        Value::String(text) => {
            let normalized = text.trim().to_ascii_lowercase();
            Some(matches!(normalized.as_str(), "true" | "1" | "yes" | "enabled"))
        }
        _ => None,
    }
}

fn value_to_i64(value: &Value) -> Option<i64> {
    match value {
        Value::Number(number) => number.as_i64(),
        Value::String(text) => text.trim().parse::<i64>().ok(),
        _ => None,
    }
}

fn first_object_from_maybe_array(value: Option<&Value>) -> Option<&Value> {
    match value {
        Some(Value::Array(items)) => items.iter().find(|item| item.is_object()),
        Some(item) if item.is_object() => Some(item),
        _ => None,
    }
}

fn strings_from_value(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::Array(items)) => items.iter().filter_map(value_to_string).collect(),
        Some(item) => value_to_string(item).into_iter().collect(),
        None => Vec::new(),
    }
}

fn parse_adapter_facts(stdout: &str) -> Vec<AdapterFact> {
    parse_json_list(stdout)
        .into_iter()
        .map(|item| AdapterFact {
            name: get_string(&item, "Name").unwrap_or_else(|| "Unknown adapter".to_string()),
            description: get_string(&item, "InterfaceDescription"),
            status: get_string(&item, "Status").unwrap_or_else(|| "Unknown".to_string()),
            interface_index: get_i64(&item, "InterfaceIndex"),
            physical_medium: get_string(&item, "NdisPhysicalMedium"),
            mac_address: get_string(&item, "MacAddress"),
            link_speed: get_string(&item, "LinkSpeed"),
            hardware_interface: get_bool(&item, "HardwareInterface").unwrap_or(true),
        })
        .collect()
}

fn parse_ip_facts(stdout: &str) -> Vec<IpFact> {
    parse_json_list(stdout)
        .into_iter()
        .map(|item| {
            let ipv4 = first_object_from_maybe_array(item.get("IPv4Address"));
            let gateway = first_object_from_maybe_array(item.get("IPv4DefaultGateway"));
            let dns_server = item.get("DNSServer");
            let profile = item.get("NetProfile");

            IpFact {
                interface_alias: get_string(&item, "InterfaceAlias"),
                interface_index: get_i64(&item, "InterfaceIndex"),
                ipv4_address: ipv4.and_then(|address| get_string(address, "IPAddress")),
                prefix_length: ipv4.and_then(|address| get_string(address, "PrefixLength")),
                gateway: gateway.and_then(|route| get_string(route, "NextHop")),
                dns_servers: dns_server
                    .and_then(|server| server.get("ServerAddresses"))
                    .map(|server| strings_from_value(Some(server)))
                    .unwrap_or_default(),
                profile_name: profile.and_then(|item| get_string(item, "Name")),
            }
        })
        .collect()
}

fn parse_ip_interface_facts(stdout: &str) -> Vec<IpInterfaceFact> {
    parse_json_list(stdout)
        .into_iter()
        .map(|item| IpInterfaceFact {
            interface_alias: get_string(&item, "InterfaceAlias"),
            interface_index: get_i64(&item, "InterfaceIndex"),
            dhcp: get_string(&item, "Dhcp"),
            connection_state: get_string(&item, "ConnectionState"),
            interface_metric: get_i64(&item, "InterfaceMetric"),
        })
        .collect()
}

fn parse_windows_profile_facts(stdout: &str) -> Vec<WindowsProfileFact> {
    parse_json_list(stdout)
        .into_iter()
        .map(|item| WindowsProfileFact {
            name: get_string(&item, "Name"),
            interface_alias: get_string(&item, "InterfaceAlias"),
            interface_index: get_i64(&item, "InterfaceIndex"),
            network_category: get_string(&item, "NetworkCategory"),
            ipv4_connectivity: get_string(&item, "IPv4Connectivity"),
            ipv6_connectivity: get_string(&item, "IPv6Connectivity"),
        })
        .collect()
}

fn parse_wifi_fact(stdout: &str) -> WifiFact {
    let mut fact = WifiFact::default();

    for line in stdout.lines() {
        let Some((raw_key, raw_value)) = line.split_once(':') else {
            continue;
        };

        let key = raw_key.trim().trim_end_matches('.').to_ascii_lowercase();
        let value = raw_value.trim();

        match key.as_str() {
            "name" => fact.name = Some(value.to_string()),
            "description" => fact.description = Some(value.to_string()),
            "state" => fact.state = Some(value.to_string()),
            "ssid" if !value.is_empty() && value != "0" => fact.ssid = Some(value.to_string()),
            "bssid" => fact.bssid = Some(value.to_string()),
            "signal" => fact.signal = Some(value.to_string()),
            "radio type" => fact.radio_type = Some(value.to_string()),
            "authentication" => fact.authentication = Some(value.to_string()),
            "profile" => fact.profile = Some(value.to_string()),
            "channel" => fact.channel = Some(value.to_string()),
            "receive rate (mbps)" => fact.receive_rate = Some(value.to_string()),
            "transmit rate (mbps)" => fact.transmit_rate = Some(value.to_string()),
            _ => {}
        }
    }

    fact
}

fn parse_wlan_profiles(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter_map(|line| line.split_once(':'))
        .filter_map(|(label, value)| {
            if label.trim().eq_ignore_ascii_case("All User Profile") {
                Some(value.trim().to_string())
            } else {
                None
            }
        })
        .collect()
}

fn parse_service_facts(stdout: &str) -> Vec<ServiceFact> {
    parse_json_list(stdout)
        .into_iter()
        .map(|item| ServiceFact {
            name: get_string(&item, "Name").unwrap_or_else(|| "Unknown".to_string()),
            status: get_string(&item, "Status").unwrap_or_else(|| "Unknown".to_string()),
            start_type: get_string(&item, "StartType"),
        })
        .collect()
}

fn parse_route_facts(stdout: &str) -> Vec<RouteFact> {
    parse_json_list(stdout)
        .into_iter()
        .map(|item| RouteFact {
            interface_alias: get_string(&item, "InterfaceAlias"),
            interface_index: get_i64(&item, "InterfaceIndex"),
            destination_prefix: get_string(&item, "DestinationPrefix"),
            next_hop: get_string(&item, "NextHop"),
            route_metric: get_i64(&item, "RouteMetric"),
            state: get_string(&item, "State"),
        })
        .collect()
}

fn parse_proxy_fact(winhttp_stdout: &str, user_proxy_stdout: &str) -> ProxyFact {
    let mut fact = ProxyFact {
        winhttp_mode: "Unknown".to_string(),
        ..ProxyFact::default()
    };

    for line in winhttp_stdout.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let normalized = line.to_ascii_lowercase();
        if normalized.contains("direct access (no proxy server)") {
            fact.winhttp_mode = "Direct".to_string();
        } else if let Some((label, value)) = line.split_once(':') {
            match label.trim().to_ascii_lowercase().as_str() {
                "proxy server(s)" => {
                    fact.winhttp_mode = "Manual".to_string();
                    fact.winhttp_server = Some(value.trim().to_string());
                }
                "bypass list" => fact.winhttp_bypass = Some(value.trim().to_string()),
                _ => {}
            }
        }
    }

    if let Some(user_proxy) = parse_json(user_proxy_stdout) {
        fact.user_proxy_enabled = get_bool(&user_proxy, "ProxyEnable").unwrap_or(false);
        fact.user_proxy_server = get_string(&user_proxy, "ProxyServer");
        fact.auto_config_url = get_string(&user_proxy, "AutoConfigURL");
        fact.auto_detect = get_bool(&user_proxy, "AutoDetect").unwrap_or(false);
    }

    fact
}

fn parse_endpoint_fact(stdout: &str) -> EndpointFact {
    let Some(json) = parse_json(stdout) else {
        return EndpointFact::default();
    };

    EndpointFact {
        computer_name: get_string(&json, "ComputerName"),
        remote_address: get_string(&json, "RemoteAddress"),
        remote_port: get_string(&json, "RemotePort"),
        tcp_succeeded: get_bool(&json, "TcpTestSucceeded").unwrap_or(false),
        ping_succeeded: get_bool(&json, "PingSucceeded").unwrap_or(false),
        interface_alias: get_string(&json, "InterfaceAlias"),
        source_address: get_string(&json, "SourceAddress"),
    }
}

fn parse_http_probe_fact(stdout: &str) -> HttpProbeFact {
    let Some(json) = parse_json(stdout) else {
        return HttpProbeFact::default();
    };

    HttpProbeFact {
        success: get_bool(&json, "Success").unwrap_or(false),
        status_code: get_i64(&json, "StatusCode"),
        final_uri: get_string(&json, "FinalUri"),
        location: get_string(&json, "Location"),
        snippet: get_string(&json, "Snippet"),
        error: get_string(&json, "Error"),
    }
}

fn count_event_issues(stdout: &str) -> (usize, Option<String>) {
    let entries = parse_json_list(stdout);
    let latest = entries.first().and_then(|item| {
        let level = get_string(item, "LevelDisplayName").unwrap_or_else(|| "Unknown".to_string());
        let id = get_string(item, "Id").unwrap_or_else(|| "?".to_string());
        let message = get_string(item, "Message").unwrap_or_else(|| "No details".to_string());
        Some(format!("{level} #{id}: {}", message.replace('\n', " ")))
    });

    (entries.len(), latest)
}

fn failed_command_output(label: &str, error: impl ToString) -> CommandOutput {
    CommandOutput {
        stdout: String::new(),
        stderr: format!("{label}: {}", error.to_string()),
        success: false,
    }
}

fn powershell_capture(command: &str, label: &str) -> CommandOutput {
    powershell(command).unwrap_or_else(|error| failed_command_output(label, error))
}

fn service_by_name<'a>(services: &'a [ServiceFact], name: &str) -> Option<&'a ServiceFact> {
    services
        .iter()
        .find(|service| service.name.eq_ignore_ascii_case(name))
}

fn primary_route<'a>(
    routes: &'a [RouteFact],
    interface_index: Option<i64>,
    gateway: Option<&str>,
) -> Option<&'a RouteFact> {
    interface_index
        .and_then(|index| {
            routes.iter().find(|route| {
                route.interface_index == Some(index)
                    && route
                        .destination_prefix
                        .as_deref()
                        .map(|value| value == "0.0.0.0/0")
                        .unwrap_or(false)
            })
        })
        .or_else(|| {
            gateway.and_then(|next_hop| {
                routes
                    .iter()
                    .find(|route| route.next_hop.as_deref() == Some(next_hop))
            })
        })
        .or_else(|| routes.first())
}

fn primary_ip_interface<'a>(
    ip_interfaces: &'a [IpInterfaceFact],
    interface_index: Option<i64>,
    interface_alias: Option<&str>,
) -> Option<&'a IpInterfaceFact> {
    interface_index
        .and_then(|index| {
            ip_interfaces
                .iter()
                .find(|fact| fact.interface_index == Some(index))
        })
        .or_else(|| {
            interface_alias.and_then(|alias| {
                ip_interfaces.iter().find(|fact| {
                    fact.interface_alias
                        .as_deref()
                        .map(|value| value.eq_ignore_ascii_case(alias))
                        .unwrap_or(false)
                })
            })
        })
        .or_else(|| ip_interfaces.first())
}

fn combine_outputs(outputs: &[(&str, &CommandOutput)]) -> String {
    outputs
        .iter()
        .filter(|(_, output)| !output.stdout.trim().is_empty() || !output.stderr.trim().is_empty())
        .map(|(label, output)| {
            let mut section = format!("=== {label} ===");
            if !output.stdout.trim().is_empty() {
                section.push('\n');
                section.push_str(output.stdout.trim());
            }
            if !output.stderr.trim().is_empty() {
                if !output.stdout.trim().is_empty() {
                    section.push('\n');
                }
                section.push_str("stderr:\n");
                section.push_str(output.stderr.trim());
            }
            section
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn placeholder_or<'a>(value: Option<&'a str>, placeholder: &'a str) -> &'a str {
    value.filter(|text| !text.trim().is_empty()).unwrap_or(placeholder)
}

fn contextual_fix_action(id: &str, adapter_alias: Option<&str>, wifi_profile: Option<&str>) -> FixAction {
    let mut action = known_fix_action(id);

    if let Some(commands) = action.commands_preview.as_mut() {
        let adapter_display = placeholder_or(adapter_alias, "<adapter>");
        let profile_display = placeholder_or(wifi_profile, "<SSID>");
        *commands = commands
            .iter()
            .map(|command| {
                command
                    .replace("<adapter>", adapter_display)
                    .replace("<SSID>", profile_display)
            })
            .collect();
    }

    action
}

fn powershell_single_quoted(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn join_non_empty(values: &[String], fallback: &str) -> String {
    let filtered: Vec<&str> = values
        .iter()
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .collect();

    if filtered.is_empty() {
        fallback.to_string()
    } else {
        filtered.join(", ")
    }
}

fn adapter_is_up(adapter: &AdapterFact) -> bool {
    adapter.status.eq_ignore_ascii_case("up")
}

fn adapter_is_wireless(adapter: &AdapterFact) -> bool {
    let medium = adapter
        .physical_medium
        .as_deref()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let name = adapter.name.to_ascii_lowercase();
    let description = adapter
        .description
        .as_deref()
        .unwrap_or_default()
        .to_ascii_lowercase();

    medium.contains("wireless")
        || name.contains("wi-fi")
        || name.contains("wifi")
        || name.contains("wlan")
        || description.contains("wireless")
        || description.contains("wi-fi")
        || description.contains("wifi")
        || description.contains("wlan")
}

fn primary_ip_fact<'a>(ip_facts: &'a [IpFact], adapters: &[AdapterFact]) -> Option<&'a IpFact> {
    let pick = |require_wireless: bool, require_up: bool, require_address: bool| {
        ip_facts.iter().find(|fact| {
            let adapter = adapters
                .iter()
                .find(|adapter| adapter.interface_index == fact.interface_index);

            let adapter_matches = match adapter {
                Some(adapter) => {
                    adapter.hardware_interface
                        && (!require_wireless || adapter_is_wireless(adapter))
                        && (!require_up || adapter_is_up(adapter))
                }
                None => !require_up && !require_wireless,
            };

            adapter_matches && (!require_address || fact.ipv4_address.is_some() || fact.gateway.is_some())
        })
    };

    pick(true, true, true)
        .or_else(|| pick(false, true, true))
        .or_else(|| pick(true, true, false))
        .or_else(|| pick(false, true, false))
        .or_else(|| ip_facts.first())
}

fn primary_adapter<'a>(
    adapters: &'a [AdapterFact],
    preferred_interface_index: Option<i64>,
) -> Option<&'a AdapterFact> {
    preferred_interface_index
        .and_then(|interface_index| {
            adapters
                .iter()
                .find(|adapter| adapter.interface_index == Some(interface_index))
        })
        .or_else(|| adapters.iter().find(|adapter| adapter.hardware_interface && adapter_is_wireless(adapter) && adapter_is_up(adapter)))
        .or_else(|| adapters.iter().find(|adapter| adapter.hardware_interface && adapter_is_up(adapter)))
        .or_else(|| adapters.iter().find(|adapter| adapter.hardware_interface))
        .or_else(|| adapters.first())
}

fn primary_windows_profile<'a>(
    profiles: &'a [WindowsProfileFact],
    interface_index: Option<i64>,
    interface_alias: Option<&str>,
) -> Option<&'a WindowsProfileFact> {
    interface_index
        .and_then(|index| profiles.iter().find(|profile| profile.interface_index == Some(index)))
        .or_else(|| {
            interface_alias.and_then(|alias| {
                profiles.iter().find(|profile| {
                    profile
                        .interface_alias
                        .as_deref()
                        .map(|value| value.eq_ignore_ascii_case(alias))
                        .unwrap_or(false)
                })
            })
        })
        .or_else(|| profiles.first())
}

fn profile_is_false_negative(profile: &WindowsProfileFact, internet_ok: bool, dns_ok: bool) -> bool {
    if !internet_ok || !dns_ok {
        return false;
    }

    matches!(
        profile
            .ipv4_connectivity
            .as_deref()
            .map(|value| value.to_ascii_lowercase()),
        Some(value) if value == "notraffic" || value == "disconnected" || value == "localnetwork"
    )
}

fn node_checks(id: &str) -> Vec<&'static str> {
    match id {
        "device" => vec![
            "Operating system detected",
            "Network stack accessible",
            "Permissions and admin status checked",
            "System clock sanity checked",
        ],
        "adapter" => vec![
            "Network adapters detected",
            "Wi-Fi adapter present",
            "Adapter enabled",
            "Driver status checked",
        ],
        "wifi" => vec![
            "WLAN AutoConfig service running",
            "Wireless interface available",
            "Interface connection state checked",
            "Nearby networks visibility checked",
        ],
        "profile" => vec![
            "Current SSID detected",
            "Saved profile exists",
            "Authentication type checked",
            "Profile consistency reviewed",
        ],
        "ip" => vec![
            "IPv4 address exists",
            "APIPA range avoided",
            "Subnet mask present",
            "DHCP configuration checked",
        ],
        "gateway" => vec![
            "Default gateway exists",
            "Route table checked",
            "Gateway reachability tested",
        ],
        "internet" => vec![
            "External IP endpoint tested",
            "Secondary endpoint compared",
            "TCP fallback considered",
        ],
        "dns" => vec![
            "DNS servers configured",
            "Domain resolution tested",
            "Public resolver comparison checked",
        ],
        "windows" => vec![
            "Windows connectivity profile checked",
            "Proxy configuration reviewed",
            "Captive portal suspicion reviewed",
        ],
        "apps" => vec![
            "HTTPS endpoint tested",
            "Proxy and firewall symptoms reviewed",
            "App-specific failure likelihood assessed",
        ],
        _ => vec!["Diagnostic data collected"],
    }
}

fn simple_mock_scan() -> ScanResult {
    let nodes = vec![
        node(
            "device",
            "Device",
            "monitor",
            DiagnosticStatus::Ok,
            "Aegis is running outside Windows.",
            "Mock scenarios remain available so the full timeline can still be previewed.",
            node_checks("device"),
            vec![
                evidence("os", "Operating system", std::env::consts::OS, DiagnosticStatus::Ok, None),
                evidence(
                    "mode",
                    "Backend mode",
                    "Mock fallback",
                    DiagnosticStatus::Warning,
                    Some("Real Windows diagnostics only run in the Windows Tauri build."),
                ),
            ],
            vec![],
            None,
        ),
        node(
            "adapter",
            "Adapter",
            "network",
            DiagnosticStatus::Skipped,
            "Real adapter inventory is unavailable here.",
            "Use demo mode or run the Windows build to inspect adapter state.",
            node_checks("adapter"),
            vec![evidence("platform", "Platform", "Non-Windows fallback", DiagnosticStatus::Unknown, None)],
            vec![],
            None,
        ),
        node(
            "wifi",
            "Wi-Fi",
            "wifi",
            DiagnosticStatus::Skipped,
            "Wireless service checks are unavailable here.",
            "The frontend mock scenarios still cover Wi-Fi failures.",
            node_checks("wifi"),
            vec![evidence("service", "WLAN AutoConfig", "Not queried", DiagnosticStatus::Unknown, None)],
            vec![],
            None,
        ),
        node(
            "profile",
            "Profile",
            "id-card",
            DiagnosticStatus::Skipped,
            "Wi-Fi profile checks are unavailable here.",
            "Aegis never requests saved passwords, even on Windows.",
            node_checks("profile"),
            vec![evidence("profile", "Current profile", "Not queried", DiagnosticStatus::Unknown, None)],
            vec![],
            None,
        ),
        node(
            "ip",
            "IP Address",
            "binary",
            DiagnosticStatus::Skipped,
            "Live IP checks are unavailable here.",
            "Switch to a Windows machine or use a mock scenario for IP failures.",
            node_checks("ip"),
            vec![evidence("ipv4", "IPv4 address", "Not queried", DiagnosticStatus::Unknown, None)],
            vec![],
            None,
        ),
        node(
            "gateway",
            "Gateway",
            "router",
            DiagnosticStatus::Skipped,
            "Gateway reachability is unavailable here.",
            "The full timeline remains visible so UI development stays mock-first.",
            node_checks("gateway"),
            vec![evidence("gateway", "Default gateway", "Not queried", DiagnosticStatus::Unknown, None)],
            vec![],
            None,
        ),
        node(
            "internet",
            "Internet",
            "globe",
            DiagnosticStatus::Skipped,
            "External reachability checks are unavailable here.",
            "Mock scenarios remain the supported path outside Windows.",
            node_checks("internet"),
            vec![evidence("internet", "External endpoint", "Not queried", DiagnosticStatus::Unknown, None)],
            vec![],
            None,
        ),
        node(
            "dns",
            "DNS",
            "search-check",
            DiagnosticStatus::Skipped,
            "Live DNS checks are unavailable here.",
            "Aegis keeps its full diagnostic UI active by falling back to mock data.",
            node_checks("dns"),
            vec![evidence("dns", "Name resolution", "Not queried", DiagnosticStatus::Unknown, None)],
            vec![],
            None,
        ),
        node(
            "windows",
            "Windows Status",
            "badge-check",
            DiagnosticStatus::Skipped,
            "Windows profile and proxy checks are unavailable here.",
            "Those probes are intentionally isolated to the Windows backend.",
            node_checks("windows"),
            vec![evidence("windows", "Windows profile", "Not queried", DiagnosticStatus::Unknown, None)],
            vec![],
            None,
        ),
        node(
            "apps",
            "Apps",
            "app-window",
            DiagnosticStatus::Skipped,
            "Application reachability checks are unavailable here.",
            "Use mock scenarios to preview app-layer failures on non-Windows systems.",
            node_checks("apps"),
            vec![evidence("apps", "HTTPS check", "Not queried", DiagnosticStatus::Unknown, None)],
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
            summary: "Real Windows diagnostics are not available on this platform. The full mock timeline remains available.".to_string(),
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

pub fn run_windows_scan(_scenario_id: Option<String>) -> Result<ScanResult, Box<dyn Error>> {
    if !cfg!(target_os = "windows") {
        return Ok(simple_mock_scan());
    }

    let is_admin = current_process_is_admin();
    let os_out = powershell_capture(
        "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,LastBootUpTime | ConvertTo-Json -Depth 4 -Compress",
        "os",
    );
    let adapter_out = powershell_capture(
        "Get-NetAdapter -IncludeHidden | Select-Object Name,InterfaceDescription,Status,MacAddress,InterfaceIndex,HardwareInterface,NdisPhysicalMedium,LinkSpeed | ConvertTo-Json -Depth 4 -Compress",
        "adapters",
    );
    let service_out = powershell_capture(
        "Get-Service WlanSvc,Dhcp,Dnscache,NlaSvc,Nsi | Select-Object Name,Status,StartType | ConvertTo-Json -Depth 4 -Compress",
        "services",
    );
    let wifi_out = powershell_capture("netsh wlan show interfaces", "wifi interfaces");
    let wlan_profiles_out = powershell_capture("netsh wlan show profiles", "wifi profiles");
    let ip_config_out = powershell_capture(
        "Get-NetIPConfiguration | Select-Object InterfaceAlias,InterfaceIndex,IPv4Address,IPv4DefaultGateway,DNSServer,NetProfile | ConvertTo-Json -Depth 6 -Compress",
        "ip config",
    );
    let ip_interface_out = powershell_capture(
        "Get-NetIPInterface -AddressFamily IPv4 | Select-Object InterfaceAlias,InterfaceIndex,Dhcp,ConnectionState,InterfaceMetric | ConvertTo-Json -Depth 4 -Compress",
        "ip interface",
    );
    let route_out = powershell_capture(
        "Get-NetRoute -AddressFamily IPv4 | Where-Object { $_.DestinationPrefix -eq '0.0.0.0/0' } | Sort-Object RouteMetric | Select-Object InterfaceAlias,InterfaceIndex,DestinationPrefix,NextHop,RouteMetric,State | ConvertTo-Json -Depth 4 -Compress",
        "routes",
    );
    let profile_out = powershell_capture(
        "Get-NetConnectionProfile | Select-Object Name,InterfaceAlias,InterfaceIndex,NetworkCategory,IPv4Connectivity,IPv6Connectivity | ConvertTo-Json -Depth 4 -Compress",
        "profiles",
    );
    let winhttp_proxy_out = powershell_capture("netsh winhttp show proxy", "winhttp proxy");
    let user_proxy_out = powershell_capture(
        "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' | Select-Object ProxyEnable,ProxyServer,AutoConfigURL,AutoDetect | ConvertTo-Json -Depth 3 -Compress",
        "user proxy",
    );
    let internet_primary_out = powershell_capture(
        "Test-NetConnection 1.1.1.1 -Port 443 -InformationLevel Detailed | Select-Object ComputerName,RemoteAddress,RemotePort,PingSucceeded,TcpTestSucceeded,InterfaceAlias,SourceAddress | ConvertTo-Json -Depth 4 -Compress",
        "internet primary",
    );
    let internet_secondary_out = powershell_capture(
        "Test-NetConnection 8.8.8.8 -Port 53 -InformationLevel Detailed | Select-Object ComputerName,RemoteAddress,RemotePort,PingSucceeded,TcpTestSucceeded,InterfaceAlias,SourceAddress | ConvertTo-Json -Depth 4 -Compress",
        "internet secondary",
    );
    let internet_tertiary_out = powershell_capture(
        "Test-NetConnection 9.9.9.9 -Port 443 -InformationLevel Detailed | Select-Object ComputerName,RemoteAddress,RemotePort,PingSucceeded,TcpTestSucceeded,InterfaceAlias,SourceAddress | ConvertTo-Json -Depth 4 -Compress",
        "internet tertiary",
    );
    let dns_out = powershell_capture(
        "try { Resolve-DnsName example.com,openai.com -Type A -ErrorAction Stop | Select-Object -First 6 Name,Type,IPAddress,Section | ConvertTo-Json -Depth 4 -Compress } catch { $_ | Out-String; exit 1 }",
        "dns local",
    );
    let dns_public_out = powershell_capture(
        "try { Resolve-DnsName example.com,openai.com -Server 1.1.1.1 -Type A -ErrorAction Stop | Select-Object -First 6 Name,Type,IPAddress,Section | ConvertTo-Json -Depth 4 -Compress } catch { $_ | Out-String; exit 1 }",
        "dns public",
    );
    let http_probe_out = powershell_capture(
        r#"try {
            $response = Invoke-WebRequest 'http://www.msftconnecttest.com/connecttest.txt' -MaximumRedirection 0 -TimeoutSec 7 -UseBasicParsing -ErrorAction Stop
            [pscustomobject]@{
                Success = $true
                StatusCode = [int]$response.StatusCode
                FinalUri = $response.BaseResponse.ResponseUri.AbsoluteUri
                Location = $response.Headers.Location
                Snippet = (($response.Content | Out-String).Trim())
                Error = $null
            } | ConvertTo-Json -Depth 4 -Compress
        } catch {
            $statusCode = $null
            $location = $null
            $finalUri = $null
            if ($_.Exception.Response) {
                try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
                try { $location = $_.Exception.Response.Headers['Location'] } catch {}
                try { $finalUri = $_.Exception.Response.ResponseUri.AbsoluteUri } catch {}
            }
            [pscustomobject]@{
                Success = $false
                StatusCode = $statusCode
                FinalUri = $finalUri
                Location = $location
                Snippet = $_.ErrorDetails.Message
                Error = $_.Exception.Message
            } | ConvertTo-Json -Depth 4 -Compress
        }"#,
        "http probe",
    );
    let apps_primary_out = powershell_capture(
        "Test-NetConnection www.microsoft.com -Port 443 -InformationLevel Detailed | Select-Object ComputerName,RemoteAddress,RemotePort,PingSucceeded,TcpTestSucceeded,InterfaceAlias,SourceAddress | ConvertTo-Json -Depth 4 -Compress",
        "apps primary",
    );
    let apps_secondary_out = powershell_capture(
        "Test-NetConnection github.com -Port 443 -InformationLevel Detailed | Select-Object ComputerName,RemoteAddress,RemotePort,PingSucceeded,TcpTestSucceeded,InterfaceAlias,SourceAddress | ConvertTo-Json -Depth 4 -Compress",
        "apps secondary",
    );
    let wlan_events_out = powershell_capture(
        "try { Get-WinEvent -LogName 'Microsoft-Windows-WLAN-AutoConfig/Operational' -MaxEvents 40 -ErrorAction Stop | Where-Object { $_.LevelDisplayName -in @('Error','Warning') } | Select-Object -First 5 TimeCreated,Id,LevelDisplayName,ProviderName,Message | ConvertTo-Json -Depth 4 -Compress } catch { '[]' }",
        "wlan events",
    );
    let dns_events_out = powershell_capture(
        "try { Get-WinEvent -LogName 'Microsoft-Windows-DNS-Client/Operational' -MaxEvents 40 -ErrorAction Stop | Where-Object { $_.LevelDisplayName -in @('Error','Warning') } | Select-Object -First 5 TimeCreated,Id,LevelDisplayName,ProviderName,Message | ConvertTo-Json -Depth 4 -Compress } catch { '[]' }",
        "dns events",
    );

    let adapters = parse_adapter_facts(&adapter_out.stdout);
    let services = parse_service_facts(&service_out.stdout);
    let ip_facts = parse_ip_facts(&ip_config_out.stdout);
    let ip_interfaces = parse_ip_interface_facts(&ip_interface_out.stdout);
    let routes = parse_route_facts(&route_out.stdout);
    let windows_profiles = parse_windows_profile_facts(&profile_out.stdout);
    let wifi_fact = parse_wifi_fact(&wifi_out.stdout);
    let saved_profiles = parse_wlan_profiles(&wlan_profiles_out.stdout);
    let proxy_fact = parse_proxy_fact(&winhttp_proxy_out.stdout, &user_proxy_out.stdout);
    let internet_primary = parse_endpoint_fact(&internet_primary_out.stdout);
    let internet_secondary = parse_endpoint_fact(&internet_secondary_out.stdout);
    let internet_tertiary = parse_endpoint_fact(&internet_tertiary_out.stdout);
    let apps_primary = parse_endpoint_fact(&apps_primary_out.stdout);
    let apps_secondary = parse_endpoint_fact(&apps_secondary_out.stdout);
    let http_probe = parse_http_probe_fact(&http_probe_out.stdout);
    let os_value = parse_json(&os_out.stdout);

    let primary_ip = primary_ip_fact(&ip_facts, &adapters);
    let primary_adapter =
        primary_adapter(&adapters, primary_ip.and_then(|fact| fact.interface_index));
    let primary_profile = primary_windows_profile(
        &windows_profiles,
        primary_ip.and_then(|fact| fact.interface_index),
        primary_ip.and_then(|fact| fact.interface_alias.as_deref()),
    );
    let primary_ip_interface = primary_ip_interface(
        &ip_interfaces,
        primary_ip.and_then(|fact| fact.interface_index),
        primary_ip.and_then(|fact| fact.interface_alias.as_deref()),
    );

    let any_physical_adapter = adapters.iter().any(|adapter| adapter.hardware_interface);
    let adapter_inventory_known = !adapters.is_empty() || adapter_out.success;
    let active_adapter = primary_adapter
        .map(|adapter| adapter_is_up(adapter))
        .unwrap_or(false);
    let has_wifi_adapter =
        adapters.iter().any(adapter_is_wireless) || wifi_fact.name.is_some() || wifi_fact.description.is_some();

    let wlan_service = service_by_name(&services, "WlanSvc");
    let dhcp_service = service_by_name(&services, "Dhcp");
    let dns_cache_service = service_by_name(&services, "Dnscache");
    let nla_service = service_by_name(&services, "NlaSvc");
    let wifi_service_running = wlan_service
        .map(|service| service.status.eq_ignore_ascii_case("running"))
        .unwrap_or(false);
    let dhcp_service_running = dhcp_service
        .map(|service| service.status.eq_ignore_ascii_case("running"))
        .unwrap_or(false);
    let dns_cache_running = dns_cache_service
        .map(|service| service.status.eq_ignore_ascii_case("running"))
        .unwrap_or(false);
    let nla_running = nla_service
        .map(|service| service.status.eq_ignore_ascii_case("running"))
        .unwrap_or(false);

    let wifi_connected = wifi_fact
        .state
        .as_deref()
        .map(|state| state.eq_ignore_ascii_case("connected"))
        .unwrap_or(false);
    let wifi_profile_name = wifi_fact.profile.clone().or_else(|| wifi_fact.ssid.clone());
    let current_profile_saved = wifi_profile_name
        .as_ref()
        .map(|name| {
            if saved_profiles.is_empty() {
                true
            } else {
                saved_profiles
                    .iter()
                    .any(|profile| profile.eq_ignore_ascii_case(name))
            }
        })
        .unwrap_or(false);

    let ipv4_address = primary_ip.and_then(|fact| fact.ipv4_address.clone());
    let prefix_length = primary_ip.and_then(|fact| fact.prefix_length.clone());
    let gateway = primary_ip.and_then(|fact| fact.gateway.clone());
    let dns_servers = primary_ip
        .map(|fact| fact.dns_servers.clone())
        .unwrap_or_default();
    let profile_name = primary_profile
        .and_then(|profile| profile.name.clone())
        .or_else(|| primary_ip.and_then(|fact| fact.profile_name.clone()));
    let ipv4_connectivity = primary_profile.and_then(|profile| profile.ipv4_connectivity.clone());
    let network_category = primary_profile.and_then(|profile| profile.network_category.clone());
    let dhcp_mode = primary_ip_interface.and_then(|fact| fact.dhcp.clone());
    let connection_state = primary_ip_interface.and_then(|fact| fact.connection_state.clone());
    let interface_metric = primary_ip_interface.and_then(|fact| fact.interface_metric);

    let has_apipa = ipv4_address
        .as_deref()
        .map(|address| address.starts_with("169.254."))
        .unwrap_or(false);
    let ip_valid = ipv4_address.is_some() && !has_apipa;

    let primary_route = primary_route(
        &routes,
        primary_ip.and_then(|fact| fact.interface_index),
        gateway.as_deref(),
    );

    let gateway_test_out = match gateway.as_deref() {
        Some(next_hop) if ip_valid => Some(powershell_capture(
            &format!(
                "Test-Connection -TargetName {} -Count 1 -Quiet | ConvertTo-Json -Compress",
                powershell_single_quoted(next_hop)
            ),
            "gateway test",
        )),
        _ => None,
    };
    let gateway_neighbor_out = match gateway.as_deref() {
        Some(next_hop) if ip_valid => Some(powershell_capture(
            &format!(
                "Get-NetNeighbor -AddressFamily IPv4 -IPAddress {} | Select-Object -First 1 IPAddress,LinkLayerAddress,State,InterfaceAlias,InterfaceIndex | ConvertTo-Json -Depth 4 -Compress",
                powershell_single_quoted(next_hop)
            ),
            "gateway neighbor",
        )),
        _ => None,
    };

    let gateway_reachable = gateway_test_out
        .as_ref()
        .and_then(|output| parse_json(&output.stdout))
        .and_then(|value| value_to_bool(&value));
    let gateway_neighbor_value = gateway_neighbor_out
        .as_ref()
        .and_then(|output| parse_json(&output.stdout));
    let gateway_neighbor = first_object_from_maybe_array(gateway_neighbor_value.as_ref());
    let gateway_neighbor_state = gateway_neighbor.and_then(|item| get_string(item, "State"));
    let gateway_neighbor_mac = gateway_neighbor.and_then(|item| get_string(item, "LinkLayerAddress"));

    let internet_primary_ok = internet_primary.tcp_succeeded || internet_primary.ping_succeeded;
    let internet_secondary_ok = internet_secondary.tcp_succeeded || internet_secondary.ping_succeeded;
    let internet_tertiary_ok = internet_tertiary.tcp_succeeded || internet_tertiary.ping_succeeded;
    let internet_endpoint_successes = [
        internet_primary_ok,
        internet_secondary_ok,
        internet_tertiary_ok,
    ]
    .into_iter()
    .filter(|success| *success)
    .count();
    let internet_ok = internet_endpoint_successes > 0;

    let dns_ok = dns_out.success;
    let dns_public_ok = dns_public_out.success;
    let local_dns_only_failure = !dns_ok && dns_public_ok;
    let proxy_configured = proxy_fact.winhttp_mode.eq_ignore_ascii_case("manual")
        || proxy_fact.user_proxy_enabled
        || proxy_fact.auto_config_url.is_some()
        || proxy_fact.auto_detect;

    let http_snippet = http_probe.snippet.as_deref().unwrap_or_default().to_ascii_lowercase();
    let http_final_uri = http_probe.final_uri.as_deref().unwrap_or_default().to_ascii_lowercase();
    let captive_portal_suspected = internet_ok
        && (http_probe.location.is_some()
            || matches!(http_probe.status_code, Some(301 | 302 | 307 | 308))
            || (http_probe.success
                && !http_final_uri.is_empty()
                && !http_final_uri.contains("msftconnecttest.com/connecttest.txt"))
            || (http_probe.success
                && !http_snippet.is_empty()
                && !http_snippet.contains("microsoft connect test")));

    let windows_false_negative = primary_profile
        .map(|profile| profile_is_false_negative(profile, internet_ok, dns_ok))
        .unwrap_or(false);

    let apps_primary_ok = apps_primary.tcp_succeeded;
    let apps_secondary_ok = apps_secondary.tcp_succeeded;
    let app_endpoint_successes = [apps_primary_ok, apps_secondary_ok]
        .into_iter()
        .filter(|success| *success)
        .count();

    let (wlan_event_count, wlan_event_latest) = count_event_issues(&wlan_events_out.stdout);
    let (dns_event_count, dns_event_latest) = count_event_issues(&dns_events_out.stdout);

    let coverage_outputs = [
        &os_out,
        &adapter_out,
        &service_out,
        &wifi_out,
        &wlan_profiles_out,
        &ip_config_out,
        &ip_interface_out,
        &route_out,
        &profile_out,
        &winhttp_proxy_out,
        &user_proxy_out,
        &wlan_events_out,
        &dns_events_out,
    ];
    let coverage_total = coverage_outputs.len();
    let coverage_ok = coverage_outputs
        .iter()
        .filter(|output| output.success || !output.stdout.trim().is_empty())
        .count();
    let coverage_penalty = ((coverage_total.saturating_sub(coverage_ok)) as i32 * 3).min(18);
    let adjust_confidence = |base: i32| -> u8 { base.saturating_sub(coverage_penalty).clamp(42, 98) as u8 };

    let adapter_status = if primary_adapter.is_some() && active_adapter {
        DiagnosticStatus::Ok
    } else if adapter_inventory_known {
        DiagnosticStatus::Failed
    } else {
        DiagnosticStatus::Unknown
    };

    let wifi_status = if !has_wifi_adapter {
        DiagnosticStatus::Skipped
    } else if wlan_service.is_some() && !wifi_service_running {
        DiagnosticStatus::Failed
    } else if wifi_connected {
        DiagnosticStatus::Ok
    } else if wifi_fact.state.is_some() {
        DiagnosticStatus::Warning
    } else {
        DiagnosticStatus::Unknown
    };

    let profile_status = if !has_wifi_adapter || !wifi_connected {
        DiagnosticStatus::Skipped
    } else if wifi_profile_name.is_some() && current_profile_saved {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::Warning
    };

    let ip_status = if active_adapter && ip_valid {
        DiagnosticStatus::Ok
    } else if active_adapter {
        DiagnosticStatus::Failed
    } else {
        DiagnosticStatus::Skipped
    };

    let gateway_status = if !ip_valid {
        DiagnosticStatus::Skipped
    } else if gateway.is_none() || primary_route.is_none() {
        DiagnosticStatus::Failed
    } else if gateway_reachable == Some(true) {
        DiagnosticStatus::Ok
    } else if internet_ok {
        DiagnosticStatus::Warning
    } else {
        DiagnosticStatus::Failed
    };

    let internet_status = if !ip_valid || gateway.is_none() {
        DiagnosticStatus::Skipped
    } else if internet_endpoint_successes >= 2 {
        DiagnosticStatus::Ok
    } else if internet_endpoint_successes == 1 {
        DiagnosticStatus::Warning
    } else {
        DiagnosticStatus::Failed
    };

    let dns_status = if matches!(internet_status, DiagnosticStatus::Failed | DiagnosticStatus::Skipped) {
        DiagnosticStatus::Skipped
    } else if dns_ok && dns_public_ok {
        DiagnosticStatus::Ok
    } else if !dns_ok {
        DiagnosticStatus::Failed
    } else {
        DiagnosticStatus::Warning
    };

    let windows_status = if captive_portal_suspected
        || windows_false_negative
        || proxy_configured
        || (!wifi_connected && wlan_event_count > 0)
        || (!dns_ok && dns_event_count > 0)
    {
        DiagnosticStatus::Warning
    } else if primary_profile.is_some() || nla_running {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::Unknown
    };

    let apps_status = if matches!(dns_status, DiagnosticStatus::Failed | DiagnosticStatus::Skipped) {
        DiagnosticStatus::Skipped
    } else if app_endpoint_successes == 2 {
        DiagnosticStatus::Ok
    } else if app_endpoint_successes == 1 {
        DiagnosticStatus::Warning
    } else {
        DiagnosticStatus::Failed
    };

    let device_status = if coverage_ok + 2 < coverage_total {
        DiagnosticStatus::Warning
    } else {
        DiagnosticStatus::Ok
    };

    let os_label = os_value
        .as_ref()
        .and_then(|value| get_string(value, "Caption"))
        .unwrap_or_else(|| "Windows".to_string());
    let os_version = os_value
        .as_ref()
        .and_then(|value| get_string(value, "Version"))
        .unwrap_or_else(|| "Unknown".to_string());
    let os_build = os_value
        .as_ref()
        .and_then(|value| get_string(value, "BuildNumber"))
        .unwrap_or_else(|| "Unknown".to_string());
    let os_last_boot = os_value
        .as_ref()
        .and_then(|value| get_string(value, "LastBootUpTime"));
    let hostname_display = hostname().unwrap_or_else(|| "Unknown".to_string());
    let os_display = format!("{os_label} {os_version} (build {os_build})");
    let dns_servers_display = join_non_empty(&dns_servers, "No DNS servers reported");
    let saved_profiles_display = if saved_profiles.is_empty() {
        "No saved profiles enumerated".to_string()
    } else {
        format!(
            "{} saved: {}",
            saved_profiles.len(),
            saved_profiles.iter().take(4).cloned().collect::<Vec<_>>().join(", ")
        )
    };
    let selected_adapter_alias = primary_ip
        .and_then(|fact| fact.interface_alias.as_deref())
        .or_else(|| primary_adapter.map(|adapter| adapter.name.as_str()));
    let selected_profile = wifi_profile_name.as_deref();
    let fix = |id: &str| contextual_fix_action(id, selected_adapter_alias, selected_profile);

    let prefix_detail = prefix_length
        .as_ref()
        .map(|prefix| format!("Prefix length /{prefix}"));
    let wifi_link_detail = match (wifi_fact.bssid.as_deref(), wifi_fact.channel.as_deref()) {
        (Some(bssid), Some(channel)) => Some(format!("BSSID {bssid}, channel {channel}")),
        (Some(bssid), None) => Some(format!("BSSID {bssid}")),
        (None, Some(channel)) => Some(format!("Channel {channel}")),
        (None, None) => None,
    };
    let wifi_rate_detail = match (
        wifi_fact.receive_rate.as_deref(),
        wifi_fact.transmit_rate.as_deref(),
    ) {
        (Some(rx), Some(tx)) => Some(format!("Rx {rx} Mbps / Tx {tx} Mbps")),
        (Some(rx), None) => Some(format!("Rx {rx} Mbps")),
        (None, Some(tx)) => Some(format!("Tx {tx} Mbps")),
        (None, None) => None,
    };
    let proxy_detail = format!(
        "WinHTTP: {}{}{}{}",
        proxy_fact.winhttp_mode,
        proxy_fact
            .winhttp_server
            .as_ref()
            .map(|server| format!(" ({server})"))
            .unwrap_or_default(),
        proxy_fact
            .user_proxy_server
            .as_ref()
            .map(|server| format!(", User {server}"))
            .unwrap_or_default(),
        proxy_fact
            .auto_config_url
            .as_ref()
            .map(|url| format!(", PAC {url}"))
            .unwrap_or_else(|| {
                if proxy_fact.auto_detect {
                    ", AutoDetect enabled".to_string()
                } else {
                    String::new()
                }
            })
    );
    let captive_portal_detail = if captive_portal_suspected {
        http_probe
            .location
            .as_ref()
            .map(|location| format!("Redirected to {location}"))
            .or_else(|| http_probe.final_uri.as_ref().map(|uri| format!("Final URI {uri}")))
            .or_else(|| http_probe.error.as_ref().map(|error| format!("Probe error: {error}")))
    } else {
        http_probe
            .status_code
            .map(|status| format!("HTTP {status} from connect test"))
    };

    let mut gateway_outputs: Vec<(&str, &CommandOutput)> =
        vec![("IP configuration", &ip_config_out), ("Routes", &route_out)];
    if let Some(output) = gateway_test_out.as_ref() {
        gateway_outputs.push(("Gateway probe", output));
    }
    if let Some(output) = gateway_neighbor_out.as_ref() {
        gateway_outputs.push(("Gateway neighbor", output));
    }

    let mut nodes = vec![
        node(
            "device",
            "Device",
            "monitor",
            device_status,
            if matches!(device_status, DiagnosticStatus::Ok) {
                "Windows diagnostic probes are available."
            } else {
                "A few diagnostic probes did not return full data."
            },
            "Aegis stays inside a fixed, read-only probe set and records when coverage is partial so confidence can be adjusted without dropping the whole scan.",
            node_checks("device"),
            vec![
                evidence("os", "Operating system", &os_display, DiagnosticStatus::Ok, os_last_boot.as_deref()),
                evidence(
                    "admin",
                    "Elevation",
                    if is_admin { "Administrator" } else { "Standard user" },
                    DiagnosticStatus::Ok,
                    Some("Read-only diagnostics work without destructive privileges."),
                ),
                evidence("host", "Hostname", &hostname_display, DiagnosticStatus::Ok, None),
                evidence(
                    "coverage",
                    "Probe coverage",
                    &format!("{coverage_ok}/{coverage_total} probe groups responded"),
                    if coverage_ok == coverage_total {
                        DiagnosticStatus::Ok
                    } else {
                        DiagnosticStatus::Warning
                    },
                    Some("Aegis keeps partial data instead of falling back to mock output when a single probe is noisy."),
                ),
            ],
            vec![],
            Some(combine_outputs(&[("OS", &os_out), ("Services", &service_out)])),
        ),
        node(
            "adapter",
            "Adapter",
            "network",
            adapter_status,
            match adapter_status {
                DiagnosticStatus::Ok => "Windows reports an active adapter for the current route.",
                DiagnosticStatus::Failed => "Windows did not expose a healthy active adapter for the route Aegis selected.",
                _ => "Adapter inventory was only partially available.",
            },
            "Aegis inspects the Windows adapter inventory to identify the interface actually carrying the current path.",
            node_checks("adapter"),
            vec![
                evidence(
                    "primary-adapter",
                    "Primary adapter",
                    primary_adapter
                        .map(|adapter| adapter.name.as_str())
                        .unwrap_or("No active adapter selected"),
                    adapter_status,
                    primary_adapter.and_then(|adapter| adapter.description.as_deref()),
                ),
                evidence(
                    "adapter-status",
                    "Adapter status",
                    primary_adapter
                        .map(|adapter| adapter.status.as_str())
                        .unwrap_or("Unavailable"),
                    if active_adapter {
                        DiagnosticStatus::Ok
                    } else if primary_adapter.is_some() {
                        DiagnosticStatus::Failed
                    } else {
                        DiagnosticStatus::Unknown
                    },
                    primary_adapter.and_then(|adapter| adapter.link_speed.as_deref()),
                ),
                evidence(
                    "adapter-medium",
                    "Medium",
                    primary_adapter
                        .and_then(|adapter| adapter.physical_medium.as_deref())
                        .unwrap_or("Unknown"),
                    if has_wifi_adapter {
                        DiagnosticStatus::Ok
                    } else {
                        DiagnosticStatus::Warning
                    },
                    Some("Aegis prefers the Wi-Fi path when it exists, but still follows the active route."),
                ),
                evidence(
                    "adapter-mac",
                    "MAC address",
                    primary_adapter
                        .and_then(|adapter| adapter.mac_address.as_deref())
                        .unwrap_or("Unavailable"),
                    DiagnosticStatus::Ok,
                    Some(&format!("{} physical adapters discovered", adapters.iter().filter(|adapter| adapter.hardware_interface).count())),
                ),
            ],
            if matches!(adapter_status, DiagnosticStatus::Failed) {
                vec![fix("open-network-settings"), fix("generate-wlan-report")]
            } else {
                vec![]
            },
            Some(combine_outputs(&[("Adapters", &adapter_out)])),
        ),
        node(
            "wifi",
            "Wi-Fi",
            "wifi",
            wifi_status,
            match wifi_status {
                DiagnosticStatus::Ok => "WLAN AutoConfig is running and the wireless interface is associated.",
                DiagnosticStatus::Failed => "The Wi-Fi service is unhealthy enough to block wireless diagnostics.",
                DiagnosticStatus::Warning => "A Wi-Fi adapter exists, but it is not currently associated to an access point.",
                _ => "Wireless checks are not currently applicable.",
            },
            "Aegis reads the live wireless interface, radio details, and service state without exposing saved credentials.",
            node_checks("wifi"),
            vec![
                evidence(
                    "wlan-service",
                    "WLAN AutoConfig",
                    wlan_service
                        .map(|service| service.status.as_str())
                        .unwrap_or("Unavailable"),
                    if wifi_service_running {
                        DiagnosticStatus::Ok
                    } else if wlan_service.is_some() {
                        DiagnosticStatus::Failed
                    } else {
                        DiagnosticStatus::Unknown
                    },
                    wlan_service.and_then(|service| service.start_type.as_deref()),
                ),
                evidence(
                    "wifi-state",
                    "Interface state",
                    wifi_fact.state.as_deref().unwrap_or("Unavailable"),
                    if wifi_connected {
                        DiagnosticStatus::Ok
                    } else if has_wifi_adapter {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Skipped
                    },
                    wifi_rate_detail.as_deref(),
                ),
                evidence(
                    "wifi-ssid",
                    "SSID",
                    wifi_fact.ssid.as_deref().unwrap_or("Not connected"),
                    if wifi_connected {
                        DiagnosticStatus::Ok
                    } else {
                        DiagnosticStatus::Unknown
                    },
                    wifi_link_detail.as_deref(),
                ),
                evidence(
                    "wifi-signal",
                    "Signal / radio",
                    wifi_fact.signal.as_deref().unwrap_or("Unavailable"),
                    if wifi_connected {
                        DiagnosticStatus::Ok
                    } else if has_wifi_adapter {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Skipped
                    },
                    wifi_fact.radio_type.as_deref(),
                ),
            ],
            if matches!(wifi_status, DiagnosticStatus::Failed) {
                vec![fix("restart-wlan-service"), fix("open-network-settings")]
            } else {
                vec![]
            },
            Some(combine_outputs(&[
                ("Services", &service_out),
                ("Wi-Fi interfaces", &wifi_out),
                ("Wi-Fi profiles", &wlan_profiles_out),
            ])),
        ),
        node(
            "profile",
            "Profile",
            "id-card",
            profile_status,
            match profile_status {
                DiagnosticStatus::Ok => "The connected network maps cleanly to a saved Wi-Fi profile.",
                DiagnosticStatus::Warning => "The interface is connected, but the current wireless profile looks stale or incomplete.",
                _ => "Profile checks wait for an active Wi-Fi association.",
            },
            "Profile inspection stays read-only: Aegis tracks names and authentication metadata, never key material.",
            node_checks("profile"),
            vec![
                evidence(
                    "profile-name",
                    "Current profile",
                    wifi_profile_name.as_deref().unwrap_or("Unavailable"),
                    match profile_status {
                        DiagnosticStatus::Ok => DiagnosticStatus::Ok,
                        DiagnosticStatus::Warning => DiagnosticStatus::Warning,
                        _ => DiagnosticStatus::Skipped,
                    },
                    Some("Only the profile name and authentication metadata are surfaced."),
                ),
                evidence(
                    "profile-auth",
                    "Authentication",
                    wifi_fact.authentication.as_deref().unwrap_or("Unavailable"),
                    if wifi_connected {
                        DiagnosticStatus::Ok
                    } else {
                        DiagnosticStatus::Skipped
                    },
                    None,
                ),
                evidence(
                    "profile-saved",
                    "Saved profile inventory",
                    &saved_profiles_display,
                    if saved_profiles.is_empty() {
                        DiagnosticStatus::Unknown
                    } else if current_profile_saved {
                        DiagnosticStatus::Ok
                    } else {
                        DiagnosticStatus::Warning
                    },
                    None,
                ),
            ],
            if matches!(profile_status, DiagnosticStatus::Warning) {
                vec![fix("forget-current-profile"), fix("open-network-settings")]
            } else {
                vec![]
            },
            Some(combine_outputs(&[
                ("Wi-Fi interfaces", &wifi_out),
                ("Wi-Fi profiles", &wlan_profiles_out),
            ])),
        ),
        node(
            "ip",
            "IP Address",
            "binary",
            ip_status,
            match ip_status {
                DiagnosticStatus::Ok => "Windows has a usable IPv4 configuration on the active interface.",
                DiagnosticStatus::Failed => "Windows does not have a usable IPv4 configuration on the active interface.",
                _ => "IP checks are waiting for an active route-bearing adapter.",
            },
            "Aegis inspects address assignment, DHCP mode, interface state, and DNS server configuration together so APIPA and stale adapter state are obvious.",
            node_checks("ip"),
            vec![
                evidence(
                    "ipv4-address",
                    "IPv4 address",
                    ipv4_address.as_deref().unwrap_or("Unavailable"),
                    if ip_valid {
                        DiagnosticStatus::Ok
                    } else if active_adapter {
                        DiagnosticStatus::Failed
                    } else {
                        DiagnosticStatus::Skipped
                    },
                    prefix_detail.as_deref(),
                ),
                evidence(
                    "apipa",
                    "APIPA check",
                    if has_apipa { "169.254.x.x detected" } else { "No APIPA detected" },
                    if has_apipa {
                        DiagnosticStatus::Failed
                    } else if ip_valid {
                        DiagnosticStatus::Ok
                    } else {
                        DiagnosticStatus::Unknown
                    },
                    None,
                ),
                evidence(
                    "dhcp-mode",
                    "DHCP mode",
                    dhcp_mode.as_deref().unwrap_or("Unavailable"),
                    if dhcp_mode
                        .as_deref()
                        .map(|mode| mode.eq_ignore_ascii_case("Enabled"))
                        .unwrap_or(false)
                    {
                        DiagnosticStatus::Ok
                    } else if dhcp_mode.is_some() {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Unknown
                    },
                    if dhcp_service_running {
                        Some("DHCP Client service is running.")
                    } else if dhcp_service.is_some() {
                        Some("DHCP Client service is not running.")
                    } else {
                        connection_state.as_deref()
                    },
                ),
                evidence(
                    "dns-servers",
                    "DNS servers",
                    &dns_servers_display,
                    if dns_servers.is_empty() {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Ok
                    },
                    interface_metric.map(|metric| format!("Interface metric {metric}")).as_deref(),
                ),
            ],
            if matches!(ip_status, DiagnosticStatus::Failed) {
                vec![fix("renew-dhcp"), fix("restart-adapter"), fix("open-network-settings")]
            } else {
                vec![]
            },
            Some(combine_outputs(&[
                ("IP configuration", &ip_config_out),
                ("IP interface", &ip_interface_out),
            ])),
        ),
        node(
            "gateway",
            "Gateway",
            "router",
            gateway_status,
            match gateway_status {
                DiagnosticStatus::Ok => "A default gateway exists and the local next hop responded.",
                DiagnosticStatus::Warning => "The gateway path exists, but direct reachability looks inconsistent.",
                DiagnosticStatus::Failed => "The local gateway is missing or did not respond when the rest of the path also looked broken.",
                _ => "Gateway checks are skipped until the interface has usable IP configuration.",
            },
            "Aegis checks the configured route, the selected next hop, and the local neighbor table before blaming the router.",
            node_checks("gateway"),
            vec![
                evidence(
                    "gateway-ip",
                    "Default gateway",
                    gateway.as_deref().unwrap_or("Unavailable"),
                    if gateway.is_some() {
                        DiagnosticStatus::Ok
                    } else if ip_valid {
                        DiagnosticStatus::Failed
                    } else {
                        DiagnosticStatus::Skipped
                    },
                    primary_route.and_then(|route| route.interface_alias.as_deref()),
                ),
                evidence(
                    "gateway-route",
                    "Default route",
                    primary_route
                        .and_then(|route| route.destination_prefix.as_deref())
                        .unwrap_or("Unavailable"),
                    if primary_route.is_some() {
                        DiagnosticStatus::Ok
                    } else if ip_valid {
                        DiagnosticStatus::Failed
                    } else {
                        DiagnosticStatus::Skipped
                    },
                    primary_route
                        .and_then(|route| route.route_metric)
                        .map(|metric| format!("Route metric {metric}"))
                        .as_deref(),
                ),
                evidence(
                    "gateway-neighbor",
                    "Neighbor state",
                    gateway_neighbor_state.as_deref().unwrap_or("Unavailable"),
                    if gateway_neighbor_state.is_some() {
                        DiagnosticStatus::Ok
                    } else if ip_valid {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Skipped
                    },
                    gateway_neighbor_mac
                        .as_ref()
                        .map(|mac| format!("Gateway MAC {mac}"))
                        .as_deref(),
                ),
                evidence(
                    "gateway-ping",
                    "Gateway reachability",
                    match gateway_reachable {
                        Some(true) => "Responded",
                        Some(false) => "No response",
                        None => "Not tested",
                    },
                    match gateway_reachable {
                        Some(true) => DiagnosticStatus::Ok,
                        Some(false) if internet_ok => DiagnosticStatus::Warning,
                        Some(false) => DiagnosticStatus::Failed,
                        None => DiagnosticStatus::Skipped,
                    },
                    None,
                ),
            ],
            if matches!(gateway_status, DiagnosticStatus::Failed) {
                vec![fix("renew-dhcp"), fix("restart-adapter"), fix("generate-wlan-report")]
            } else {
                vec![]
            },
            Some(combine_outputs(&gateway_outputs)),
        ),
        node(
            "internet",
            "Internet",
            "globe",
            internet_status,
            match internet_status {
                DiagnosticStatus::Ok => "External reachability works across multiple public endpoints.",
                DiagnosticStatus::Warning => "At least one public endpoint responded, but the path is not fully stable.",
                DiagnosticStatus::Failed => "Public IP reachability failed even though the local route exists.",
                _ => "Internet checks wait for a usable local route.",
            },
            "Aegis compares multiple IP targets so one blocked or filtered destination does not dominate the diagnosis.",
            node_checks("internet"),
            vec![
                evidence(
                    "internet-primary",
                    "1.1.1.1:443",
                    if internet_primary_ok { "Reachable" } else { "Unreachable" },
                    if internet_primary_ok {
                        DiagnosticStatus::Ok
                    } else if matches!(internet_status, DiagnosticStatus::Skipped) {
                        DiagnosticStatus::Skipped
                    } else {
                        DiagnosticStatus::Failed
                    },
                    internet_primary
                        .source_address
                        .as_ref()
                        .map(|source| format!("Source {source}"))
                        .as_deref(),
                ),
                evidence(
                    "internet-secondary",
                    "8.8.8.8:53",
                    if internet_secondary_ok { "Reachable" } else { "Unreachable" },
                    if internet_secondary_ok {
                        DiagnosticStatus::Ok
                    } else if matches!(internet_status, DiagnosticStatus::Skipped) {
                        DiagnosticStatus::Skipped
                    } else {
                        DiagnosticStatus::Warning
                    },
                    internet_secondary
                        .source_address
                        .as_ref()
                        .map(|source| format!("Source {source}"))
                        .as_deref(),
                ),
                evidence(
                    "internet-tertiary",
                    "9.9.9.9:443",
                    if internet_tertiary_ok { "Reachable" } else { "Unreachable" },
                    if internet_tertiary_ok {
                        DiagnosticStatus::Ok
                    } else if matches!(internet_status, DiagnosticStatus::Skipped) {
                        DiagnosticStatus::Skipped
                    } else {
                        DiagnosticStatus::Warning
                    },
                    internet_tertiary
                        .source_address
                        .as_ref()
                        .map(|source| format!("Source {source}"))
                        .as_deref(),
                ),
            ],
            if matches!(internet_status, DiagnosticStatus::Failed) {
                vec![fix("renew-dhcp"), fix("restart-adapter"), fix("generate-wlan-report")]
            } else {
                vec![]
            },
            Some(combine_outputs(&[
                ("1.1.1.1", &internet_primary_out),
                ("8.8.8.8", &internet_secondary_out),
                ("9.9.9.9", &internet_tertiary_out),
            ])),
        ),
        node(
            "dns",
            "DNS",
            "search-check",
            dns_status,
            match dns_status {
                DiagnosticStatus::Ok => "Local and public DNS probes both resolved test hostnames.",
                DiagnosticStatus::Failed => "The local DNS path failed even though raw reachability exists.",
                DiagnosticStatus::Warning => "DNS works locally, but the public comparison returned mixed signals.",
                _ => "DNS is downstream of base reachability and is skipped when the route is broken.",
            },
            "Aegis resolves multiple hostnames locally, compares them to a public resolver, and keeps DNS service and event-log context nearby so resolver issues are easier to prove.",
            node_checks("dns"),
            vec![
                evidence(
                    "dns-local",
                    "Local resolver",
                    if dns_ok {
                        "Resolved example.com and openai.com"
                    } else {
                        "Resolution failed"
                    },
                    if dns_ok {
                        DiagnosticStatus::Ok
                    } else if matches!(dns_status, DiagnosticStatus::Skipped) {
                        DiagnosticStatus::Skipped
                    } else {
                        DiagnosticStatus::Failed
                    },
                    None,
                ),
                evidence(
                    "dns-public",
                    "Public resolver comparison",
                    if dns_public_ok {
                        "1.1.1.1 resolved the same hostnames"
                    } else {
                        "Public comparison failed"
                    },
                    if dns_public_ok {
                        DiagnosticStatus::Ok
                    } else if matches!(dns_status, DiagnosticStatus::Skipped) {
                        DiagnosticStatus::Skipped
                    } else {
                        DiagnosticStatus::Warning
                    },
                    Some("A local-only failure usually points to adapter DNS settings, resolver health, or stale cache."),
                ),
                evidence(
                    "dns-config",
                    "Configured DNS servers",
                    &dns_servers_display,
                    if dns_servers.is_empty() {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Ok
                    },
                    None,
                ),
                evidence(
                    "dns-service",
                    "DNS Client service",
                    dns_cache_service
                        .map(|service| service.status.as_str())
                        .unwrap_or("Unavailable"),
                    if dns_cache_running {
                        DiagnosticStatus::Ok
                    } else if dns_cache_service.is_some() {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Unknown
                    },
                    dns_event_latest.as_deref(),
                ),
            ],
            if matches!(dns_status, DiagnosticStatus::Failed) {
                if local_dns_only_failure {
                    vec![
                        fix("flush-dns"),
                        fix("dns-automatic"),
                        fix("set-public-dns"),
                        fix("renew-dhcp"),
                    ]
                } else {
                    vec![fix("flush-dns"), fix("renew-dhcp"), fix("dns-automatic")]
                }
            } else {
                vec![]
            },
            Some(combine_outputs(&[
                ("Local DNS", &dns_out),
                ("Public DNS", &dns_public_out),
                ("DNS events", &dns_events_out),
            ])),
        ),
        node(
            "windows",
            "Windows Status",
            "badge-check",
            windows_status,
            match windows_status {
                DiagnosticStatus::Ok => "Windows profile, NLA state, and proxy settings look consistent with the observed path.",
                DiagnosticStatus::Warning => "Windows profile metadata or HTTP behavior may be contributing to the user-visible symptom.",
                _ => "Windows did not return a clear profile for the selected route.",
            },
            "Aegis cross-checks Windows connectivity status, proxy settings, event logs, and a captive-portal probe so OS-level symptoms can be separated from core routing failures.",
            node_checks("windows"),
            vec![
                evidence(
                    "network-profile",
                    "Network profile",
                    profile_name.as_deref().unwrap_or("Unavailable"),
                    if primary_profile.is_some() {
                        DiagnosticStatus::Ok
                    } else {
                        DiagnosticStatus::Unknown
                    },
                    network_category
                        .as_ref()
                        .map(|category| format!("Category {category}"))
                        .as_deref(),
                ),
                evidence(
                    "ipv4-connectivity",
                    "Windows IPv4 status",
                    ipv4_connectivity.as_deref().unwrap_or("Unavailable"),
                    if windows_false_negative {
                        DiagnosticStatus::Warning
                    } else if primary_profile.is_some() {
                        DiagnosticStatus::Ok
                    } else {
                        DiagnosticStatus::Unknown
                    },
                    primary_profile
                        .and_then(|profile| profile.ipv6_connectivity.as_ref())
                        .map(|value| format!("IPv6 {value}"))
                        .as_deref(),
                ),
                evidence(
                    "proxy",
                    "Proxy configuration",
                    if proxy_configured {
                        "Proxy, PAC, or auto-detect is enabled"
                    } else {
                        "Direct access"
                    },
                    if proxy_configured {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Ok
                    },
                    Some(&proxy_detail),
                ),
                evidence(
                    "captive-portal",
                    "Captive portal probe",
                    if captive_portal_suspected {
                        "HTTP probe looked intercepted"
                    } else {
                        "No portal redirect observed"
                    },
                    if captive_portal_suspected {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Ok
                    },
                    captive_portal_detail.as_deref(),
                ),
                evidence(
                    "windows-events",
                    "Recent WLAN/DNS warnings",
                    &format!("{wlan_event_count} WLAN, {dns_event_count} DNS"),
                    if wlan_event_count > 0 || dns_event_count > 0 {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Ok
                    },
                    wlan_event_latest
                        .as_ref()
                        .or(dns_event_latest.as_ref())
                        .map(String::as_str),
                ),
            ],
            if proxy_configured || captive_portal_suspected {
                vec![fix("open-network-settings"), fix("generate-wlan-report")]
            } else {
                vec![]
            },
            Some(combine_outputs(&[
                ("Profiles", &profile_out),
                ("WinHTTP proxy", &winhttp_proxy_out),
                ("User proxy", &user_proxy_out),
                ("Captive portal", &http_probe_out),
                ("WLAN events", &wlan_events_out),
                ("DNS events", &dns_events_out),
            ])),
        ),
        node(
            "apps",
            "Apps",
            "app-window",
            apps_status,
            match apps_status {
                DiagnosticStatus::Ok => "HTTPS application endpoints responded normally.",
                DiagnosticStatus::Warning => "Some application endpoints responded, but the app layer is still inconsistent.",
                DiagnosticStatus::Failed => "Lower layers passed, but both HTTPS application probes failed.",
                _ => "Application checks wait until lower network layers pass.",
            },
            "Aegis uses multiple HTTPS endpoints to distinguish app-layer failures from lower transport or DNS problems.",
            node_checks("apps"),
            vec![
                evidence(
                    "apps-primary",
                    "www.microsoft.com:443",
                    if apps_primary_ok { "Reachable" } else { "Not confirmed" },
                    if apps_primary_ok {
                        DiagnosticStatus::Ok
                    } else if matches!(apps_status, DiagnosticStatus::Skipped) {
                        DiagnosticStatus::Skipped
                    } else {
                        DiagnosticStatus::Warning
                    },
                    apps_primary
                        .source_address
                        .as_ref()
                        .map(|source| format!("Source {source}"))
                        .as_deref(),
                ),
                evidence(
                    "apps-secondary",
                    "github.com:443",
                    if apps_secondary_ok { "Reachable" } else { "Not confirmed" },
                    if apps_secondary_ok {
                        DiagnosticStatus::Ok
                    } else if matches!(apps_status, DiagnosticStatus::Skipped) {
                        DiagnosticStatus::Skipped
                    } else {
                        DiagnosticStatus::Warning
                    },
                    apps_secondary
                        .source_address
                        .as_ref()
                        .map(|source| format!("Source {source}"))
                        .as_deref(),
                ),
                evidence(
                    "apps-stability",
                    "HTTPS endpoint coverage",
                    &format!("{app_endpoint_successes}/2 endpoints responded"),
                    if app_endpoint_successes == 2 {
                        DiagnosticStatus::Ok
                    } else if app_endpoint_successes == 1 {
                        DiagnosticStatus::Warning
                    } else if matches!(apps_status, DiagnosticStatus::Skipped) {
                        DiagnosticStatus::Skipped
                    } else {
                        DiagnosticStatus::Failed
                    },
                    None,
                ),
                evidence(
                    "proxy-suspect",
                    "Proxy influence",
                    if proxy_configured {
                        "Proxy settings exist"
                    } else {
                        "No proxy settings detected"
                    },
                    if proxy_configured {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Ok
                    },
                    Some("Proxy or TLS inspection can break apps even when lower-layer routing still works."),
                ),
            ],
            if matches!(apps_status, DiagnosticStatus::Failed | DiagnosticStatus::Warning) {
                vec![fix("open-network-settings"), fix("generate-wlan-report")]
            } else {
                vec![]
            },
            Some(combine_outputs(&[
                ("Microsoft endpoint", &apps_primary_out),
                ("GitHub endpoint", &apps_secondary_out),
            ])),
        ),
    ];

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "device") {
        if matches!(device_status, DiagnosticStatus::Warning) {
            node.likely_causes = vec![
                "One or more read-only probe groups returned partial data.".to_string(),
                "Aegis retained partial evidence instead of abandoning the real scan.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "adapter") {
        if matches!(adapter_status, DiagnosticStatus::Failed) {
            node.likely_causes = vec![
                "The active adapter is disabled, unplugged, or not initializing cleanly.".to_string(),
                "Windows did not expose a healthy route-bearing interface.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "wifi") {
        if matches!(wifi_status, DiagnosticStatus::Failed) {
            node.likely_causes = vec![
                "WLAN AutoConfig is stopped or unavailable.".to_string(),
                "The wireless interface cannot participate in scans until the service is healthy.".to_string(),
            ];
        } else if matches!(wifi_status, DiagnosticStatus::Warning) {
            node.likely_causes = vec![
                "The Wi-Fi adapter exists, but it is not associated with an access point.".to_string(),
                "Radio state, distance, or authentication may be preventing association.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "profile") {
        if matches!(profile_status, DiagnosticStatus::Warning) {
            node.likely_causes = vec![
                "The current SSID does not map cleanly to an enumerated saved profile.".to_string(),
                "A stale wireless profile can leave the interface connected but unstable.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "ip") {
        if matches!(ip_status, DiagnosticStatus::Failed) {
            node.likely_causes = vec![
                "DHCP may not have completed successfully.".to_string(),
                "A 169.254.x.x address usually means the router did not hand out a lease.".to_string(),
                "Adapter state or DHCP client service state may be stale.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "gateway") {
        if matches!(gateway_status, DiagnosticStatus::Failed | DiagnosticStatus::Warning) {
            node.likely_causes = vec![
                "The default route exists, but the local next hop is inconsistent or unreachable.".to_string(),
                "The router may be down, filtering probes, or not answering from this interface.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "internet") {
        if matches!(internet_status, DiagnosticStatus::Failed | DiagnosticStatus::Warning) {
            node.likely_causes = vec![
                "The local path exists, but public upstream reachability is degraded.".to_string(),
                "VPN, firewall, ISP, or router upstream issues can produce this pattern.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "dns") {
        if matches!(dns_status, DiagnosticStatus::Failed) {
            node.likely_causes = vec![
                "Local DNS lookups failed even though raw internet reachability still exists.".to_string(),
                "Adapter DNS settings, the local resolver path, or stale cache are likely suspects.".to_string(),
                if !dns_cache_running && dns_cache_service.is_some() {
                    "The DNS Client service is not running.".to_string()
                } else {
                    "Recent DNS client warnings may explain intermittent failures.".to_string()
                },
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "windows") {
        if captive_portal_suspected {
            node.likely_causes = vec![
                "HTTP traffic appears redirected, which strongly suggests a captive portal.".to_string(),
                "Public or hotel Wi-Fi sign-in may be required before normal browsing works.".to_string(),
            ];
        } else if windows_false_negative {
            node.likely_causes = vec![
                "Windows is reporting limited connectivity despite successful routing and DNS checks.".to_string(),
            ];
        } else if proxy_configured {
            node.likely_causes = vec![
                "Manual proxy, PAC, or auto-detect settings may be altering browser and app behavior.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "apps") {
        if matches!(apps_status, DiagnosticStatus::Failed | DiagnosticStatus::Warning) {
            node.likely_causes = vec![
                "Application traffic failed after lower layers mostly passed.".to_string(),
                "Proxy, TLS interception, endpoint filtering, or remote service filtering are plausible causes.".to_string(),
            ];
        }
    }

    let primary_problem_node_id = nodes
        .iter()
        .find(|node| matches!(node.status, DiagnosticStatus::Failed))
        .or_else(|| {
            nodes.iter().find(|node| matches!(node.status, DiagnosticStatus::Warning))
        })
        .map(|node| node.id.clone());
    let overall_status = if nodes
        .iter()
        .any(|node| matches!(node.status, DiagnosticStatus::Failed))
    {
        DiagnosticStatus::Failed
    } else if nodes
        .iter()
        .any(|node| matches!(node.status, DiagnosticStatus::Warning))
    {
        DiagnosticStatus::Warning
    } else {
        DiagnosticStatus::Ok
    };

    let (diagnosis_id, title, summary, confidence, recommended_fixes) =
        if matches!(adapter_status, DiagnosticStatus::Failed) {
            (
                "no-adapter",
                "No usable network adapter detected",
                "Windows did not expose a healthy active adapter for the current route.",
                adjust_confidence(94),
                vec![fix("open-network-settings"), fix("generate-wlan-report")],
            )
        } else if has_wifi_adapter && wlan_service.is_some() && !wifi_service_running {
            (
                "wlan-service-stopped",
                "Windows Wi-Fi service is not running",
                "WLAN AutoConfig is stopped or unavailable, so wireless diagnostics cannot complete cleanly.",
                adjust_confidence(95),
                vec![fix("restart-wlan-service"), fix("open-network-settings")],
            )
        } else if matches!(profile_status, DiagnosticStatus::Warning) {
            (
                "wifi-profile-mismatch",
                "The Wi-Fi profile looks stale or inconsistent",
                "The interface is associated, but the saved wireless profile does not line up cleanly with the active network.",
                adjust_confidence(84),
                vec![fix("forget-current-profile"), fix("open-network-settings")],
            )
        } else if matches!(ip_status, DiagnosticStatus::Failed) {
            (
                "dhcp-failure",
                "Connected adapter, but no valid IP address",
                "Windows did not report a usable IPv4 address on the active interface.",
                adjust_confidence(if has_apipa { 96 } else { 91 }),
                vec![fix("renew-dhcp"), fix("restart-adapter"), fix("open-network-settings")],
            )
        } else if matches!(gateway_status, DiagnosticStatus::Failed) {
            (
                "gateway-unreachable",
                "Local gateway is not responding",
                "The adapter has a route, but the default gateway did not answer when the rest of the path also looked broken.",
                adjust_confidence(88),
                vec![fix("renew-dhcp"), fix("restart-adapter"), fix("generate-wlan-report")],
            )
        } else if matches!(internet_status, DiagnosticStatus::Failed) {
            (
                "internet-unreachable",
                "Router path works, but the internet is unreachable",
                "The local path is present, but every public IP probe failed.",
                adjust_confidence(86),
                vec![fix("renew-dhcp"), fix("restart-adapter"), fix("generate-wlan-report")],
            )
        } else if local_dns_only_failure {
            (
                "dns-failure",
                "Connected, but the local DNS path is failing",
                "Public IP reachability works and the public resolver comparison succeeded, so the failure is likely in local DNS settings or cache.",
                adjust_confidence(96),
                vec![
                    fix("flush-dns"),
                    fix("dns-automatic"),
                    fix("set-public-dns"),
                    fix("renew-dhcp"),
                ],
            )
        } else if matches!(dns_status, DiagnosticStatus::Failed) {
            (
                "dns-failure",
                "Connected, but DNS is failing",
                "External IP connectivity works, but local hostname resolution still failed.",
                adjust_confidence(90),
                vec![fix("flush-dns"), fix("renew-dhcp"), fix("dns-automatic")],
            )
        } else if captive_portal_suspected {
            (
                "captive-portal",
                "The network may require browser sign-in",
                "HTTP connectivity appears redirected, which is a strong captive-portal pattern.",
                adjust_confidence(87),
                vec![fix("open-network-settings"), fix("generate-wlan-report")],
            )
        } else if proxy_configured && matches!(apps_status, DiagnosticStatus::Failed | DiagnosticStatus::Warning) {
            (
                "proxy-app-issue",
                "Proxy settings may be breaking apps",
                "Lower-layer connectivity mostly passed, but proxy configuration is present and HTTPS application probes were degraded.",
                adjust_confidence(82),
                vec![fix("open-network-settings"), fix("generate-wlan-report")],
            )
        } else if windows_false_negative {
            (
                "windows-false-negative",
                "Windows says the network is limited, but traffic works",
                "Routing and DNS checks succeeded even though Windows profile status still looks degraded.",
                adjust_confidence(79),
                vec![fix("flush-dns"), fix("generate-wlan-report"), fix("open-network-settings")],
            )
        } else if matches!(apps_status, DiagnosticStatus::Failed) {
            (
                "apps-endpoint-failure",
                "Lower layers pass, but app traffic is still failing",
                "Internet and DNS probes passed, but HTTPS application endpoints still failed.",
                adjust_confidence(76),
                vec![fix("open-network-settings"), fix("generate-wlan-report")],
            )
        } else if matches!(overall_status, DiagnosticStatus::Ok) {
            (
                "healthy",
                "Everything looks good",
                "The read-only diagnostic chain completed without finding a clear break point.",
                adjust_confidence(94),
                vec![],
            )
        } else {
            (
                "degraded",
                "Network path is degraded",
                "Aegis found warning-level symptoms, but no single high-confidence break point dominated the scan.",
                adjust_confidence(70),
                vec![fix("generate-wlan-report"), fix("open-network-settings")],
            )
        };

    Ok(ScanResult {
        id: now_id(),
        created_at: now_iso(),
        mode: "real".to_string(),
        overall_status,
        diagnosis: OverallDiagnosis {
            id: diagnosis_id.to_string(),
            title: title.to_string(),
            summary: summary.to_string(),
            confidence,
            severity: if diagnosis_id == "no-adapter" {
                Severity::Critical
            } else if nodes
                .iter()
                .any(|node| matches!(node.status, DiagnosticStatus::Failed))
            {
                Severity::High
            } else if matches!(overall_status, DiagnosticStatus::Warning) {
                Severity::Medium
            } else {
                Severity::Info
            },
            primary_failed_node_id: primary_problem_node_id,
            recommended_fixes,
        },
        nodes,
        environment: Environment {
            os: "Windows".to_string(),
            hostname: hostname(),
            app_version: "0.1.0".to_string(),
            is_admin: Some(is_admin),
        },
    })
}

#[derive(Debug, Clone, Default)]
struct ExecutionContext {
    adapter_alias: Option<String>,
    wifi_profile: Option<String>,
}

fn discover_execution_context() -> ExecutionContext {
    let adapter_out = powershell_capture(
        "Get-NetAdapter -IncludeHidden | Select-Object Name,InterfaceDescription,Status,MacAddress,InterfaceIndex,HardwareInterface,NdisPhysicalMedium,LinkSpeed | ConvertTo-Json -Depth 4 -Compress",
        "fix adapters",
    );
    let ip_config_out = powershell_capture(
        "Get-NetIPConfiguration | Select-Object InterfaceAlias,InterfaceIndex,IPv4Address,IPv4DefaultGateway,DNSServer,NetProfile | ConvertTo-Json -Depth 6 -Compress",
        "fix ip config",
    );
    let wifi_out = powershell_capture("netsh wlan show interfaces", "fix wifi interfaces");

    let adapters = parse_adapter_facts(&adapter_out.stdout);
    let ip_facts = parse_ip_facts(&ip_config_out.stdout);
    let wifi_fact = parse_wifi_fact(&wifi_out.stdout);
    let primary_ip = primary_ip_fact(&ip_facts, &adapters);
    let adapter = primary_adapter(&adapters, primary_ip.and_then(|fact| fact.interface_index));

    ExecutionContext {
        adapter_alias: primary_ip
            .and_then(|fact| fact.interface_alias.clone())
            .or_else(|| adapter.map(|adapter| adapter.name.clone())),
        wifi_profile: wifi_fact.profile.or(wifi_fact.ssid),
    }
}

fn run_process_owned(
    program: &str,
    args: &[String],
    timeout: Duration,
) -> Result<CommandOutput, Box<dyn Error>> {
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_process(program, &arg_refs, timeout)
}

pub fn run_allowlisted_fix(
    fix_id: &str,
    confirmation: Option<&FixConfirmation>,
) -> Result<FixExecutionResult, Box<dyn Error>> {
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

    let base_fix = match fix_action(fix_id) {
        Some(fix) => fix,
        None => {
            return Ok(blocked_fix_result(
                fix_id,
                "Unknown fix",
                "The requested fix ID is not in the backend allowlist.",
                false,
            ))
        }
    };

    if let Some(result) = validate_fix_confirmation(&base_fix, confirmation) {
        return Ok(result);
    }

    if base_fix.requires_admin && !current_process_is_admin() {
        return Ok(blocked_fix_result(
            fix_id,
            "Administrator required",
            "This fix requires elevation in the Windows Tauri app. Re-launch Aegis as administrator and try again.",
            true,
        ));
    }

    let context = discover_execution_context();
    let fix = contextual_fix_action(
        fix_id,
        context.adapter_alias.as_deref(),
        context.wifi_profile.as_deref(),
    );

    let commands: Vec<(String, Vec<String>)> = match fix_id {
        "flush-dns" => vec![("ipconfig.exe".to_string(), vec!["/flushdns".to_string()])],
        "renew-dhcp" => vec![
            ("ipconfig.exe".to_string(), vec!["/release".to_string()]),
            ("ipconfig.exe".to_string(), vec!["/renew".to_string()]),
        ],
        "restart-wlan-service" => vec![(
            "powershell.exe".to_string(),
            vec![
                "-NoProfile".to_string(),
                "-NonInteractive".to_string(),
                "-Command".to_string(),
                "Restart-Service WlanSvc".to_string(),
            ],
        )],
        "generate-wlan-report" => vec![(
            "netsh.exe".to_string(),
            vec!["wlan".to_string(), "show".to_string(), "wlanreport".to_string()],
        )],
        "open-network-settings" => vec![(
            "powershell.exe".to_string(),
            vec![
                "-NoProfile".to_string(),
                "-NonInteractive".to_string(),
                "-Command".to_string(),
                "Start-Process ms-settings:network".to_string(),
            ],
        )],
        "restart-adapter" => {
            let Some(adapter_alias) = context.adapter_alias.as_deref() else {
                return Ok(blocked_fix_result(
                    fix_id,
                    "Target adapter unavailable",
                    "Aegis could not determine the active adapter to target for this fix. Re-run diagnostics and review the selected timeline path.",
                    fix.requires_admin,
                ));
            };

            let quoted = powershell_single_quoted(adapter_alias);
            vec![
                (
                    "powershell.exe".to_string(),
                    vec![
                        "-NoProfile".to_string(),
                        "-NonInteractive".to_string(),
                        "-Command".to_string(),
                        format!("Disable-NetAdapter -Name {quoted} -Confirm:$false"),
                    ],
                ),
                (
                    "powershell.exe".to_string(),
                    vec![
                        "-NoProfile".to_string(),
                        "-NonInteractive".to_string(),
                        "-Command".to_string(),
                        format!("Enable-NetAdapter -Name {quoted} -Confirm:$false"),
                    ],
                ),
            ]
        }
        "forget-current-profile" => {
            let Some(profile_name) = context.wifi_profile.as_deref() else {
                return Ok(blocked_fix_result(
                    fix_id,
                    "Wi-Fi profile unavailable",
                    "Aegis could not determine the current Wi-Fi profile name to target safely.",
                    fix.requires_admin,
                ));
            };

            vec![(
                "netsh.exe".to_string(),
                vec![
                    "wlan".to_string(),
                    "delete".to_string(),
                    "profile".to_string(),
                    format!("name={profile_name}"),
                ],
            )]
        }
        "dns-automatic" => {
            let Some(adapter_alias) = context.adapter_alias.as_deref() else {
                return Ok(blocked_fix_result(
                    fix_id,
                    "Target adapter unavailable",
                    "Aegis could not determine the active adapter to target for DNS reset.",
                    fix.requires_admin,
                ));
            };

            vec![(
                "powershell.exe".to_string(),
                vec![
                    "-NoProfile".to_string(),
                    "-NonInteractive".to_string(),
                    "-Command".to_string(),
                    format!(
                        "Set-DnsClientServerAddress -InterfaceAlias {} -ResetServerAddresses",
                        powershell_single_quoted(adapter_alias)
                    ),
                ],
            )]
        }
        "set-public-dns" => {
            let Some(adapter_alias) = context.adapter_alias.as_deref() else {
                return Ok(blocked_fix_result(
                    fix_id,
                    "Target adapter unavailable",
                    "Aegis could not determine the active adapter to target for DNS override.",
                    fix.requires_admin,
                ));
            };

            vec![(
                "powershell.exe".to_string(),
                vec![
                    "-NoProfile".to_string(),
                    "-NonInteractive".to_string(),
                    "-Command".to_string(),
                    format!(
                        "Set-DnsClientServerAddress -InterfaceAlias {} -ServerAddresses 1.1.1.1,8.8.8.8",
                        powershell_single_quoted(adapter_alias)
                    ),
                ],
            )]
        }
        "winsock-reset" => vec![(
            "netsh.exe".to_string(),
            vec!["winsock".to_string(), "reset".to_string()],
        )],
        "tcpip-reset" => vec![(
            "netsh.exe".to_string(),
            vec!["int".to_string(), "ip".to_string(), "reset".to_string()],
        )],
        "full-network-reset-settings" => vec![(
            "powershell.exe".to_string(),
            vec![
                "-NoProfile".to_string(),
                "-NonInteractive".to_string(),
                "-Command".to_string(),
                "Start-Process ms-settings:network-status".to_string(),
            ],
        )],
        _ => {
            return Ok(blocked_fix_result(
                fix_id,
                "Unknown fix",
                "The requested fix ID is not in the backend allowlist.",
                false,
            ));
        }
    };

    let mut stdout = String::new();
    let mut stderr = String::new();
    let mut success = true;

    for (program, args) in commands {
        stdout.push_str("$ ");
        stdout.push_str(&program);
        if !args.is_empty() {
            stdout.push(' ');
            stdout.push_str(&args.join(" "));
        }
        stdout.push('\n');

        match run_process_owned(&program, &args, Duration::from_secs(20)) {
            Ok(output) => {
                if !output.stdout.is_empty() {
                    stdout.push_str(&output.stdout);
                    if !output.stdout.ends_with('\n') {
                        stdout.push('\n');
                    }
                }
                if !output.stderr.is_empty() {
                    stderr.push_str(&output.stderr);
                    if !output.stderr.ends_with('\n') {
                        stderr.push('\n');
                    }
                }
                success = success && output.success;
            }
            Err(error) => {
                success = false;
                stderr.push_str(&format!("Failed to start {program}: {error}\n"));
            }
        }
    }

    Ok(FixExecutionResult {
        fix_id: fix_id.to_string(),
        status: if success { "success" } else { "failed" }.to_string(),
        title: fix.title.clone(),
        message: if success {
            "Allowlisted fix completed.".to_string()
        } else {
            "Allowlisted fix finished with errors. Review stderr.".to_string()
        },
        stdout: Some(stdout),
        stderr: if stderr.is_empty() { None } else { Some(stderr) },
        requires_admin: Some(fix.requires_admin),
    })
}

pub fn generate_wlan_report_impl() -> Result<FixExecutionResult, Box<dyn Error>> {
    run_allowlisted_fix("generate-wlan-report", None)
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
        is_admin: Some(current_process_is_admin()),
        is_windows: cfg!(target_os = "windows"),
        is_tauri: true,
    }
}
