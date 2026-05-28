#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

mod commands;
mod diagnostics;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::run_scan,
            commands::run_fix,
            commands::export_report,
            commands::generate_wlan_report,
            commands::get_environment_info,
            commands::get_runtime_health,
            commands::get_system_metrics
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aegis Trace");
}

fn main() {
    run();
}
