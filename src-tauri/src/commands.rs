use crate::filename::suggested_filename;
use crate::filesystem::{original_path, read_html, write_html, OpenedFiles};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub(crate) async fn open_html(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<Option<(String, String, usize)>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("HTML 파일 열기")
            .add_filter("HTML 문서", &["html", "htm"])
            .blocking_pick_file();
        let Some(selected) = selected else {
            return Ok(None);
        };
        let path = selected.into_path().map_err(|error| error.to_string())?;
        let files = tauri::Manager::state::<OpenedFiles>(&app);
        read_html(path, &files).map(Some)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub(crate) async fn overwrite_html(
    files: tauri::State<'_, OpenedFiles>,
    file_id: usize,
    html: String,
) -> Result<bool, String> {
    let path = original_path(&files, file_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        write_html(&path, &html)?;
        Ok(true)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub(crate) async fn save_html(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    html: String,
    name: String,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("HTML 파일 저장")
            .set_file_name(suggested_filename(&name))
            .add_filter("HTML 문서", &["html", "htm"])
            .blocking_save_file();
        let Some(selected) = selected else {
            return Ok(None);
        };
        let path = selected.into_path().map_err(|error| error.to_string())?;
        write_html(&path, &html)?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|error| error.to_string())?
}
