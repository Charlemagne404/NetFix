fn main() {
    #[cfg(target_os = "windows")]
    embed_resource::compile("windows/aegis-trace.rc", embed_resource::NONE);

    tauri_build::build();
}
