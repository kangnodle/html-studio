use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Default)]
pub(crate) struct OpenedFiles(Mutex<Vec<PathBuf>>);

pub(crate) fn read_html(
    path: PathBuf,
    files: &OpenedFiles,
) -> Result<(String, String, usize), String> {
    let html = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let name = path
        .file_name()
        .ok_or("Invalid file name")?
        .to_string_lossy()
        .into_owned();
    let mut paths = files.0.lock().map_err(|error| error.to_string())?;
    let file_id = paths.len();
    paths.push(path);
    Ok((name, html, file_id))
}

pub(crate) fn original_path(files: &OpenedFiles, file_id: usize) -> Result<PathBuf, String> {
    files
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .get(file_id)
        .cloned()
        .ok_or_else(|| "Original file is not open".to_string())
}

pub(crate) fn write_html(path: &Path, html: &str) -> Result<(), String> {
    replace_file(path, |file| file.write_all(html.as_bytes())).map_err(|error| error.to_string())
}

fn replace_file(
    path: &Path,
    write: impl FnOnce(&mut std::fs::File) -> io::Result<()>,
) -> io::Result<()> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
    write(temporary.as_file_mut())?;
    temporary.as_file().sync_all()?;
    // Persist replaces only after the entire write succeeds, on the same filesystem.
    temporary.persist(path).map_err(|error| error.error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn partial_write_failure_preserves_original_and_removes_temporary_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("page.html");
        std::fs::write(&path, "original").unwrap();
        let result = replace_file(&path, |file| {
            file.write_all(b"partial")?;
            Err(io::Error::other("injected write failure"))
        });
        assert!(result.is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "original");
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[cfg(windows)]
    #[test]
    fn failed_replacement_preserves_locked_original_and_removes_temporary_file() {
        use std::os::windows::fs::OpenOptionsExt;
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("page.html");
        std::fs::write(&path, "original").unwrap();
        let locked = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&path)
            .unwrap();
        assert!(write_html(&path, "replacement").is_err());
        drop(locked);
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "original");
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn saves_utf8_html_and_reports_write_errors() {
        let directory =
            std::env::temp_dir().join(format!("html-studio-test-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("page.html");
        let html = "<!doctype html><html><body>한글 편집 ✓</body></html>";
        write_html(&path, html).unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), html);
        let files = OpenedFiles::default();
        let (name, contents, file_id) = read_html(path.clone(), &files).unwrap();
        assert_eq!(name, "page.html");
        assert_eq!(contents, html);
        write_html(&original_path(&files, file_id).unwrap(), "edited 한글").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "edited 한글");
        assert!(original_path(&files, file_id + 1).is_err());
        assert!(write_html(&directory.join("missing/page.html"), html).is_err());
        std::fs::remove_file(path).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }
}
