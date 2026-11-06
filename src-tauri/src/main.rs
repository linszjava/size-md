#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod storage;
mod ipic;
mod theme_files;
mod local_images;
mod menus;
mod documents;
use tauri::Emitter;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| { menus::install(app.handle(), &[], "gothic", &Default::default())?; Ok(()) })
        .on_menu_event(|app, event| { let _ = app.emit("menu-action", event.id().as_ref()); })
        .invoke_handler(tauri::generate_handler![ipic::open_ipic_download, ipic::check_ipic, ipic::upload_ipic, theme_files::read_theme_font, theme_files::read_theme_source, theme_files::import_theme_folder, theme_files::list_theme_files, theme_files::save_theme_file, local_images::default_image_directory, local_images::configure_image_directory, local_images::save_local_image, local_images::read_local_image, storage::save_credentials, storage::upload_image, menus::sync_theme_menu, documents::export_pdf, documents::prepare_document_directory, documents::rename_document, documents::show_document_title])
        .run(tauri::generate_context!())
        .expect("Failed to start Size MD");
}
