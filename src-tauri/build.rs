fn main() {
    let attributes =
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "save_html",
            "open_html",
            "overwrite_html",
        ]));
    tauri_build::try_build(attributes).expect("Failed to build HTML Studio permissions");
}
