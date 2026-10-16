#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod filename;
mod filesystem;

fn main() {
    tauri::Builder::default()
        .manage(filesystem::OpenedFiles::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::save_html,
            commands::open_html,
            commands::overwrite_html
        ])
        .run(tauri::generate_context!())
        .expect("Failed to start HTML Studio");
}
