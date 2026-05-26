use crate::diagnostics::{
    environment_info, export_local_report, generate_wlan_report_impl, run_allowlisted_fix,
    run_windows_scan, EnvironmentInfo, FixExecutionResult, ScanResult,
};

#[tauri::command]
pub async fn run_scan(scenario_id: Option<String>) -> Result<ScanResult, String> {
    run_windows_scan(scenario_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn run_fix(fix_id: String) -> Result<FixExecutionResult, String> {
    run_allowlisted_fix(&fix_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn export_report(
    _scan: serde_json::Value,
    format: String,
    content: String,
) -> Result<String, String> {
    export_local_report(&format, &content).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn generate_wlan_report() -> Result<FixExecutionResult, String> {
    generate_wlan_report_impl().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_environment_info() -> Result<EnvironmentInfo, String> {
    Ok(environment_info())
}
