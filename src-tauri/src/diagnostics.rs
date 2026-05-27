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
    hardware_interface: bool,
}

#[derive(Debug, Clone, Default)]
struct WifiFact {
    name: Option<String>,
    description: Option<String>,
    state: Option<String>,
    ssid: Option<String>,
    signal: Option<String>,
    radio_type: Option<String>,
    authentication: Option<String>,
    profile: Option<String>,
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
struct EndpointFact {
    computer_name: Option<String>,
    remote_address: Option<String>,
    remote_port: Option<String>,
    tcp_succeeded: bool,
    ping_succeeded: bool,
    interface_alias: Option<String>,
    source_address: Option<String>,
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
            "signal" => fact.signal = Some(value.to_string()),
            "radio type" => fact.radio_type = Some(value.to_string()),
            "authentication" => fact.authentication = Some(value.to_string()),
            "profile" => fact.profile = Some(value.to_string()),
            _ => {}
        }
    }

    fact
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
    let os_out = powershell(
        "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber | ConvertTo-Json -Depth 3 -Compress",
    )?;
    let adapter_out = powershell(
        "Get-NetAdapter -IncludeHidden | Select-Object Name,InterfaceDescription,Status,MacAddress,InterfaceIndex,HardwareInterface,NdisPhysicalMedium | ConvertTo-Json -Depth 4 -Compress",
    )?;
    let wlan_service_out =
        powershell("Get-Service WlanSvc | Select-Object Name,Status,StartType | ConvertTo-Json -Compress")?;
    let wifi_out = powershell("netsh wlan show interfaces")?;
    let ip_config_out = powershell(
        "Get-NetIPConfiguration | Select-Object InterfaceAlias,InterfaceIndex,IPv4Address,IPv4DefaultGateway,DNSServer,NetProfile | ConvertTo-Json -Depth 6 -Compress",
    )?;
    let profile_out = powershell(
        "Get-NetConnectionProfile | Select-Object Name,InterfaceAlias,InterfaceIndex,NetworkCategory,IPv4Connectivity,IPv6Connectivity | ConvertTo-Json -Depth 4 -Compress",
    )?;
    let winhttp_proxy_out = powershell("netsh winhttp show proxy")?;
    let user_proxy_out = powershell(
        "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' | Select-Object ProxyEnable,ProxyServer,AutoConfigURL,AutoDetect | ConvertTo-Json -Depth 3 -Compress",
    )?;
    let internet_primary_out = powershell(
        "Test-NetConnection 1.1.1.1 -Port 443 -InformationLevel Detailed | Select-Object ComputerName,RemoteAddress,RemotePort,NameResolutionSucceeded,PingSucceeded,TcpTestSucceeded,InterfaceAlias,SourceAddress | ConvertTo-Json -Depth 4 -Compress",
    )?;
    let internet_secondary_out = powershell(
        "Test-NetConnection 8.8.8.8 -Port 53 -InformationLevel Detailed | Select-Object ComputerName,RemoteAddress,RemotePort,NameResolutionSucceeded,PingSucceeded,TcpTestSucceeded,InterfaceAlias,SourceAddress | ConvertTo-Json -Depth 4 -Compress",
    )?;
    let dns_out = powershell(
        "try { Resolve-DnsName example.com -Type A -ErrorAction Stop | Select-Object -First 2 Name,Type,IPAddress,Section | ConvertTo-Json -Depth 3 -Compress } catch { $_ | Out-String; exit 1 }",
    )?;
    let dns_public_out = powershell(
        "try { Resolve-DnsName example.com -Server 1.1.1.1 -Type A -ErrorAction Stop | Select-Object -First 2 Name,Type,IPAddress,Section | ConvertTo-Json -Depth 3 -Compress } catch { $_ | Out-String; exit 1 }",
    )?;
    let apps_out = powershell(
        "Test-NetConnection www.microsoft.com -Port 443 -InformationLevel Detailed | Select-Object ComputerName,RemoteAddress,RemotePort,NameResolutionSucceeded,PingSucceeded,TcpTestSucceeded,InterfaceAlias,SourceAddress | ConvertTo-Json -Depth 4 -Compress",
    )?;

    let adapters = parse_adapter_facts(&adapter_out.stdout);
    let ip_facts = parse_ip_facts(&ip_config_out.stdout);
    let windows_profiles = parse_windows_profile_facts(&profile_out.stdout);
    let wifi_fact = parse_wifi_fact(&wifi_out.stdout);
    let proxy_fact = parse_proxy_fact(&winhttp_proxy_out.stdout, &user_proxy_out.stdout);
    let internet_primary = parse_endpoint_fact(&internet_primary_out.stdout);
    let internet_secondary = parse_endpoint_fact(&internet_secondary_out.stdout);
    let apps_endpoint = parse_endpoint_fact(&apps_out.stdout);
    let os_value = parse_json(&os_out.stdout);
    let wlan_service_value = parse_json(&wlan_service_out.stdout);

    let primary_ip = primary_ip_fact(&ip_facts, &adapters);
    let primary_adapter = primary_adapter(&adapters, primary_ip.and_then(|fact| fact.interface_index));
    let primary_profile = primary_windows_profile(
        &windows_profiles,
        primary_ip.and_then(|fact| fact.interface_index),
        primary_ip.and_then(|fact| fact.interface_alias.as_deref()),
    );

    let any_physical_adapter = adapters.iter().any(|adapter| adapter.hardware_interface);
    let active_adapter = primary_adapter.map(|adapter| adapter_is_up(adapter)).unwrap_or(false);
    let has_wifi_adapter = adapters.iter().any(adapter_is_wireless);
    let wifi_service_running = wlan_service_value
        .as_ref()
        .and_then(|item| get_string(item, "Status"))
        .map(|status| status.eq_ignore_ascii_case("running"))
        .unwrap_or(false);
    let wifi_connected = wifi_fact
        .state
        .as_deref()
        .map(|state| state.eq_ignore_ascii_case("connected"))
        .unwrap_or(false);
    let wifi_profile_name = wifi_fact.profile.clone().or_else(|| wifi_fact.ssid.clone());

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

    let has_apipa = ipv4_address
        .as_deref()
        .map(|address| address.starts_with("169.254."))
        .unwrap_or(false);
    let ip_valid = ipv4_address.is_some() && !has_apipa;

    let gateway_test_out = match gateway.as_deref() {
        Some(next_hop) if ip_valid => Some(powershell(&format!(
            "Test-Connection -TargetName '{}' -Count 1 -Quiet | ConvertTo-Json -Compress",
            next_hop
        ))?),
        _ => None,
    };
    let gateway_reachable = gateway_test_out
        .as_ref()
        .and_then(|output| parse_json(&output.stdout))
        .and_then(|value| value_to_bool(&value));

    let internet_primary_ok = internet_primary.tcp_succeeded || internet_primary.ping_succeeded;
    let internet_secondary_ok = internet_secondary.tcp_succeeded || internet_secondary.ping_succeeded;
    let internet_ok = internet_primary_ok || internet_secondary_ok;
    let dns_ok = dns_out.success;
    let dns_public_ok = dns_public_out.success;
    let proxy_configured = proxy_fact.winhttp_mode.eq_ignore_ascii_case("manual")
        || proxy_fact.user_proxy_enabled
        || proxy_fact.auto_config_url.is_some();
    let windows_false_negative = primary_profile
        .map(|profile| profile_is_false_negative(profile, internet_ok, dns_ok))
        .unwrap_or(false);

    let adapter_status = if any_physical_adapter && active_adapter {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::Failed
    };

    let wifi_status = if !has_wifi_adapter {
        DiagnosticStatus::Skipped
    } else if !wifi_service_running {
        DiagnosticStatus::Failed
    } else if wifi_connected {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::Warning
    };

    let profile_status = if !has_wifi_adapter {
        DiagnosticStatus::Skipped
    } else if wifi_connected && wifi_profile_name.is_some() {
        DiagnosticStatus::Ok
    } else if wifi_connected {
        DiagnosticStatus::Warning
    } else {
        DiagnosticStatus::Skipped
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
    } else if gateway.is_none() {
        DiagnosticStatus::Failed
    } else if gateway_reachable == Some(true) {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::Failed
    };

    let internet_status = if !matches!(gateway_status, DiagnosticStatus::Ok) {
        DiagnosticStatus::Skipped
    } else if internet_ok {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::Failed
    };

    let dns_status = if !matches!(internet_status, DiagnosticStatus::Ok) {
        DiagnosticStatus::Skipped
    } else if dns_ok {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::Failed
    };

    let windows_status = if windows_false_negative || proxy_configured {
        DiagnosticStatus::Warning
    } else if primary_profile.is_some() {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::Unknown
    };

    let apps_https_ok = apps_endpoint.tcp_succeeded;
    let apps_status = if !internet_ok || !dns_ok {
        DiagnosticStatus::Skipped
    } else if apps_https_ok {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::Warning
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
    let hostname_display = hostname().unwrap_or_else(|| "Unknown".to_string());
    let os_display = format!("{os_label} {os_version} (build {os_build})");
    let dns_servers_display = join_non_empty(&dns_servers, "No DNS servers reported");
    let prefix_detail = prefix_length
        .as_ref()
        .map(|prefix| format!("Prefix length /{prefix}"));
    let internet_primary_detail = internet_primary
        .source_address
        .as_ref()
        .map(|source| format!("Source {source}"));
    let internet_secondary_detail = internet_secondary
        .source_address
        .as_ref()
        .map(|source| format!("Source {source}"));
    let gateway_raw_output = gateway_test_out
        .as_ref()
        .map(|output| format!("{}\n{}", ip_config_out.stdout, output.stdout))
        .unwrap_or_else(|| ip_config_out.stdout.clone());
    let windows_category_detail = network_category
        .as_ref()
        .map(|category| format!("Category {category}"));
    let windows_ipv6_detail = primary_profile
        .and_then(|profile| profile.ipv6_connectivity.as_ref())
        .map(|value| format!("IPv6 {value}"));
    let proxy_detail = format!(
        "WinHTTP: {}{}{}",
        proxy_fact.winhttp_mode,
        proxy_fact
            .winhttp_server
            .as_ref()
            .map(|server| format!(" ({server})"))
            .unwrap_or_default(),
        proxy_fact
            .auto_config_url
            .as_ref()
            .map(|url| format!(", AutoConfig {url}"))
            .unwrap_or_default()
    );
    let apps_source_detail = apps_endpoint
        .source_address
        .as_ref()
        .map(|source| format!("Source {source}"));

    let mut nodes = vec![
        node(
            "device",
            "Device",
            "monitor",
            DiagnosticStatus::Ok,
            "Windows diagnostics are available.",
            "Aegis is using fixed read-only Windows probes only.",
            node_checks("device"),
            vec![
                evidence(
                    "os",
                    "Operating system",
                    &os_display,
                    DiagnosticStatus::Ok,
                    None,
                ),
                evidence(
                    "admin",
                    "Elevation",
                    if is_admin { "Administrator" } else { "Standard user" },
                    DiagnosticStatus::Ok,
                    Some("Read-only diagnostics do not require destructive privileges."),
                ),
                evidence(
                    "host",
                    "Hostname",
                    &hostname_display,
                    DiagnosticStatus::Ok,
                    None,
                ),
            ],
            vec![],
            Some(os_out.stdout.clone()),
        ),
        node(
            "adapter",
            "Adapter",
            "network",
            adapter_status.clone(),
            if matches!(adapter_status, DiagnosticStatus::Ok) {
                "Windows reports an active physical network adapter."
            } else {
                "Windows did not report an active physical network adapter."
            },
            "Aegis inspects Windows adapter inventory to locate the interface driving the current route.",
            node_checks("adapter"),
            vec![
                evidence(
                    "primary-adapter",
                    "Primary adapter",
                    primary_adapter
                        .map(|adapter| adapter.name.as_str())
                        .unwrap_or("No active adapter selected"),
                    adapter_status.clone(),
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
                    } else {
                        DiagnosticStatus::Failed
                    },
                    None,
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
                    Some("Wireless is preferred when troubleshooting Wi-Fi, but other active adapters are still surfaced."),
                ),
                evidence(
                    "adapter-mac",
                    "MAC address",
                    primary_adapter
                        .and_then(|adapter| adapter.mac_address.as_deref())
                        .unwrap_or("Unavailable"),
                    DiagnosticStatus::Ok,
                    None,
                ),
            ],
            if matches!(adapter_status, DiagnosticStatus::Ok) {
                vec![]
            } else {
                vec![
                    known_fix_action("open-network-settings"),
                    known_fix_action("generate-wlan-report"),
                ]
            },
            Some(adapter_out.stdout.clone()),
        ),
        node(
            "wifi",
            "Wi-Fi",
            "wifi",
            wifi_status.clone(),
            match wifi_status {
                DiagnosticStatus::Ok => "WLAN AutoConfig is running and the wireless interface is connected.",
                DiagnosticStatus::Failed => "The Wi-Fi service is not healthy enough for wireless diagnostics.",
                DiagnosticStatus::Warning => "A Wi-Fi adapter exists, but it is not currently connected.",
                _ => "No Wi-Fi adapter is in use, so wireless checks are not applicable.",
            },
            "Aegis queries the WLAN AutoConfig service and the current wireless interface state without reading any saved passwords.",
            node_checks("wifi"),
            vec![
                evidence(
                    "wlan-service",
                    "WLAN AutoConfig",
                    wlan_service_value
                        .as_ref()
                        .and_then(|item| get_string(item, "Status"))
                        .as_deref()
                        .unwrap_or("Unavailable"),
                    if wifi_service_running {
                        DiagnosticStatus::Ok
                    } else if has_wifi_adapter {
                        DiagnosticStatus::Failed
                    } else {
                        DiagnosticStatus::Skipped
                    },
                    None,
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
                    wifi_fact.signal.as_deref(),
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
                    wifi_fact.radio_type.as_deref(),
                ),
            ],
            if !wifi_service_running && has_wifi_adapter {
                vec![known_fix_action("restart-wlan-service")]
            } else {
                vec![]
            },
            Some(format!("{}\n{}", wlan_service_out.stdout, wifi_out.stdout)),
        ),
        node(
            "profile",
            "Profile",
            "id-card",
            profile_status.clone(),
            match profile_status {
                DiagnosticStatus::Ok => "Windows reports a current Wi-Fi profile for the connected network.",
                DiagnosticStatus::Warning => "The interface is connected, but Aegis could not confidently match the current Wi-Fi profile.",
                _ => "Wi-Fi profile checks are skipped until a wireless connection is active.",
            },
            "Profile checks stay read-only and never expose or request wireless passwords.",
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
                    Some("Only profile names and authentication metadata are surfaced."),
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
            ],
            vec![],
            Some(wifi_out.stdout.clone()),
        ),
        node(
            "ip",
            "IP Address",
            "binary",
            ip_status.clone(),
            match ip_status {
                DiagnosticStatus::Ok => "Windows has a usable IPv4 configuration on the active interface.",
                DiagnosticStatus::Failed => "Windows does not have a usable IPv4 configuration on the active interface.",
                _ => "IP checks are waiting on an active adapter.",
            },
            "Aegis inspects local interface configuration for IPv4, APIPA, subnet, and DNS server evidence.",
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
                    "dns-servers",
                    "DNS servers",
                    &dns_servers_display,
                    if dns_servers.is_empty() {
                        DiagnosticStatus::Warning
                    } else {
                        DiagnosticStatus::Ok
                    },
                    primary_ip.and_then(|fact| fact.interface_alias.as_deref()),
                ),
            ],
            if matches!(ip_status, DiagnosticStatus::Failed) {
                vec![known_fix_action("renew-dhcp")]
            } else {
                vec![]
            },
            Some(ip_config_out.stdout.clone()),
        ),
        node(
            "gateway",
            "Gateway",
            "router",
            gateway_status.clone(),
            match gateway_status {
                DiagnosticStatus::Ok => "A default gateway is configured and responded to a read-only reachability probe.",
                DiagnosticStatus::Failed => "The local gateway is missing or did not respond to a reachability probe.",
                _ => "Gateway checks are skipped until IP configuration is usable.",
            },
            "Aegis verifies both the configured default route and a basic reachability probe to the next hop.",
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
                    None,
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
                        Some(false) => DiagnosticStatus::Failed,
                        None => DiagnosticStatus::Skipped,
                    },
                    None,
                ),
            ],
            if matches!(gateway_status, DiagnosticStatus::Failed) {
                vec![
                    known_fix_action("renew-dhcp"),
                    known_fix_action("generate-wlan-report"),
                ]
            } else {
                vec![]
            },
            Some(
                gateway_raw_output,
            ),
        ),
        node(
            "internet",
            "Internet",
            "globe",
            internet_status.clone(),
            match internet_status {
                DiagnosticStatus::Ok => "External reachability works over at least one known public endpoint.",
                DiagnosticStatus::Failed => "External reachability failed even though the local gateway appears usable.",
                _ => "Internet reachability is not meaningful until local gateway checks pass.",
            },
            "Aegis compares two external endpoints so a single blocked destination does not dominate the diagnosis.",
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
                    internet_primary_detail.as_deref(),
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
                    internet_secondary_detail.as_deref(),
                ),
            ],
            if matches!(internet_status, DiagnosticStatus::Failed) {
                vec![
                    known_fix_action("renew-dhcp"),
                    known_fix_action("generate-wlan-report"),
                ]
            } else {
                vec![]
            },
            Some(format!(
                "{}\n{}",
                internet_primary_out.stdout, internet_secondary_out.stdout
            )),
        ),
        node(
            "dns",
            "DNS",
            "search-check",
            dns_status.clone(),
            match dns_status {
                DiagnosticStatus::Ok => "Domain name resolution succeeded through the local DNS path.",
                DiagnosticStatus::Failed => "Domain name resolution failed even though external IP reachability works.",
                _ => "DNS is treated as downstream of basic internet reachability.",
            },
            "Aegis resolves a neutral hostname locally and compares it to a public-resolver lookup to separate DNS issues from broader connectivity loss.",
            node_checks("dns"),
            vec![
                evidence(
                    "dns-local",
                    "Local resolver",
                    if dns_ok { "Resolved example.com" } else { "Resolution failed" },
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
                    if dns_public_ok { "1.1.1.1 resolved example.com" } else { "Public comparison failed" },
                    if dns_public_ok {
                        DiagnosticStatus::Ok
                    } else if matches!(dns_status, DiagnosticStatus::Skipped) {
                        DiagnosticStatus::Skipped
                    } else {
                        DiagnosticStatus::Warning
                    },
                    Some("A local-only failure usually points to adapter or resolver configuration."),
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
            ],
            if matches!(dns_status, DiagnosticStatus::Failed) {
                vec![known_fix_action("flush-dns"), known_fix_action("renew-dhcp")]
            } else {
                vec![]
            },
            Some(format!("{}\n{}", dns_out.stdout, dns_public_out.stdout)),
        ),
        node(
            "windows",
            "Windows Status",
            "badge-check",
            windows_status.clone(),
            match windows_status {
                DiagnosticStatus::Ok => "Windows network profile and proxy settings look consistent with the observed path.",
                DiagnosticStatus::Warning => "Windows profile or proxy state may be contributing to user-visible symptoms.",
                _ => "Windows did not return a connection profile for the selected path.",
            },
            "Aegis reviews Windows network profile metadata and proxy configuration without changing either.",
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
                    windows_category_detail.as_deref(),
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
                    windows_ipv6_detail.as_deref(),
                ),
                evidence(
                    "proxy",
                    "Proxy configuration",
                    if proxy_configured {
                        "Proxy or PAC configuration detected"
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
            ],
            if proxy_configured {
                vec![known_fix_action("open-network-settings")]
            } else {
                vec![]
            },
            Some(format!(
                "{}\n{}\n{}",
                profile_out.stdout, winhttp_proxy_out.stdout, user_proxy_out.stdout
            )),
        ),
        node(
            "apps",
            "Apps",
            "app-window",
            apps_status.clone(),
            match apps_status {
                DiagnosticStatus::Ok => "An HTTPS endpoint responded, so application traffic should be able to reach the internet.",
                DiagnosticStatus::Warning => "Basic internet connectivity exists, but an HTTPS application endpoint still failed.",
                _ => "Application checks are deferred until lower layers pass.",
            },
            "Aegis uses a read-only HTTPS endpoint check to separate app symptoms from lower network failures.",
            node_checks("apps"),
            vec![
                evidence(
                    "https-endpoint",
                    "www.microsoft.com:443",
                    if apps_https_ok { "Reachable" } else { "Not confirmed" },
                    if apps_https_ok {
                        DiagnosticStatus::Ok
                    } else if matches!(apps_status, DiagnosticStatus::Skipped) {
                        DiagnosticStatus::Skipped
                    } else {
                        DiagnosticStatus::Warning
                    },
                    apps_source_detail.as_deref(),
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
                    Some("Proxy configuration can break apps even when lower-layer routing still works."),
                ),
            ],
            vec![],
            Some(apps_out.stdout.clone()),
        ),
    ];

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "adapter") {
        if matches!(adapter_status, DiagnosticStatus::Failed) {
            node.likely_causes = vec![
                "The active adapter is disabled, unplugged, or failing driver initialization.".to_string(),
                "Windows did not expose a usable physical adapter to the routing stack.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "wifi") {
        if matches!(wifi_status, DiagnosticStatus::Failed) {
            node.likely_causes = vec![
                "WLAN AutoConfig is stopped or unavailable.".to_string(),
                "The wireless adapter cannot participate in scans until the service is healthy.".to_string(),
            ];
        } else if matches!(wifi_status, DiagnosticStatus::Warning) {
            node.likely_causes =
                vec!["The Wi-Fi adapter exists, but it is not associated to an access point.".to_string()];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "ip") {
        if matches!(ip_status, DiagnosticStatus::Failed) {
            node.likely_causes = vec![
                "DHCP may not have completed successfully.".to_string(),
                "A 169.254.x.x address usually indicates the router did not hand out a lease.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "gateway") {
        if matches!(gateway_status, DiagnosticStatus::Failed) {
            node.likely_causes = vec![
                "The adapter has no default route, or the router did not answer a direct probe.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "internet") {
        if matches!(internet_status, DiagnosticStatus::Failed) {
            node.likely_causes = vec![
                "The local router path exists, but upstream internet access is not reaching public endpoints.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "dns") {
        if matches!(dns_status, DiagnosticStatus::Failed) {
            node.likely_causes = vec![
                "DNS lookups failed even though raw internet reachability succeeded.".to_string(),
                "Local DNS server settings may be stale or misconfigured.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "windows") {
        if windows_false_negative {
            node.likely_causes = vec![
                "Windows is reporting reduced connectivity despite successful routing and DNS checks.".to_string(),
            ];
        } else if proxy_configured {
            node.likely_causes = vec![
                "Manual proxy or PAC settings may be affecting browser and app traffic.".to_string(),
            ];
        }
    }

    if let Some(node) = nodes.iter_mut().find(|node| node.id == "apps") {
        if matches!(apps_status, DiagnosticStatus::Warning) {
            node.likely_causes = vec![
                "Application traffic failed after lower network layers passed.".to_string(),
                "Proxy, TLS interception, or endpoint filtering are plausible causes.".to_string(),
            ];
        }
    }

    let primary_failed_node_id = nodes
        .iter()
        .find(|node| matches!(node.status, DiagnosticStatus::Failed))
        .map(|node| node.id.clone());
    let overall_status = if primary_failed_node_id.is_some() {
        DiagnosticStatus::Failed
    } else if nodes
        .iter()
        .any(|node| matches!(node.status, DiagnosticStatus::Warning))
    {
        DiagnosticStatus::Warning
    } else {
        DiagnosticStatus::Ok
    };

    let (diagnosis_id, title, summary, confidence, recommended_fixes) = if !any_physical_adapter || !active_adapter {
        (
            "no-adapter",
            "No usable network adapter detected",
            "Windows did not expose an active physical adapter for the current route.",
            92,
            vec![
                known_fix_action("open-network-settings"),
                known_fix_action("generate-wlan-report"),
            ],
        )
    } else if has_wifi_adapter && !wifi_service_running {
        (
            "wlan-service-stopped",
            "Windows Wi-Fi service is not running",
            "WLAN AutoConfig is stopped or unavailable, so wireless diagnostics cannot complete cleanly.",
            93,
            vec![known_fix_action("restart-wlan-service")],
        )
    } else if active_adapter && !ip_valid {
        (
            "dhcp-failure",
            "Connected adapter, but no valid IP address",
            "Windows did not report a usable IPv4 address on the active interface.",
            90,
            vec![known_fix_action("renew-dhcp")],
        )
    } else if ip_valid && gateway.is_some() && gateway_reachable == Some(false) {
        (
            "gateway-unreachable",
            "Local gateway is not responding",
            "The adapter has a route, but the default gateway did not answer a direct probe.",
            87,
            vec![
                known_fix_action("renew-dhcp"),
                known_fix_action("generate-wlan-report"),
            ],
        )
    } else if matches!(gateway_status, DiagnosticStatus::Ok) && !internet_ok {
        (
            "internet-unreachable",
            "Router path works, but the internet is unreachable",
            "The local gateway responded, but public endpoints still failed.",
            84,
            vec![
                known_fix_action("renew-dhcp"),
                known_fix_action("generate-wlan-report"),
            ],
        )
    } else if internet_ok && !dns_ok {
        (
            "dns-failure",
            "Connected, but DNS is failing",
            "External IP connectivity works, but domain resolution failed.",
            94,
            vec![known_fix_action("flush-dns"), known_fix_action("renew-dhcp")],
        )
    } else if proxy_configured && internet_ok && !apps_https_ok {
        (
            "proxy-app-issue",
            "Proxy settings may be breaking apps",
            "Lower-layer connectivity passed, but Windows proxy configuration is present and the HTTPS app check failed.",
            80,
            vec![known_fix_action("open-network-settings")],
        )
    } else if windows_false_negative {
        (
            "windows-false-negative",
            "Windows says the network is limited, but traffic works",
            "The route and DNS checks succeeded even though Windows profile status looks degraded.",
            78,
            vec![known_fix_action("generate-wlan-report")],
        )
    } else if matches!(overall_status, DiagnosticStatus::Ok) && apps_https_ok {
        (
            "healthy",
            "Everything looks good",
            "The implemented read-only checks passed across the connection chain.",
            93,
            vec![],
        )
    } else {
        (
            "degraded",
            "Network path is degraded",
            "Aegis found warning-level symptoms, but no single high-confidence break point dominated the scan.",
            68,
            vec![known_fix_action("generate-wlan-report")],
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
            severity: if primary_failed_node_id.is_some() {
                Severity::High
            } else if matches!(overall_status, DiagnosticStatus::Warning) {
                Severity::Medium
            } else {
                Severity::Info
            },
            primary_failed_node_id,
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

    let fix = match fix_action(fix_id) {
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

    if let Some(result) = validate_fix_confirmation(&fix, confirmation) {
        return Ok(result);
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
            return Ok(blocked_fix_result(
                fix_id,
                "Advanced fix blocked in v0.1",
                "This fix is allowlisted and confirmed, but execution is intentionally disabled until adapter/SSID targeting and Windows-side validation are implemented.",
                fix.requires_admin,
            ));
        }
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
        let output = run_process(program, &args, Duration::from_secs(18))?;
        stdout.push_str(&output.stdout);
        stderr.push_str(&output.stderr);
        success = success && output.success;
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
