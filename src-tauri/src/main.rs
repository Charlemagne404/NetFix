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
            commands::get_environment_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aegis Network Doctor");
}

fn main() {
    run();
}
