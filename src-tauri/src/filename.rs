pub(crate) fn suggested_filename(name: &str) -> String {
    let basename = name.rsplit(['/', '\\']).next().unwrap_or_default();
    let cleaned: String = basename
        .chars()
        .filter(|character| !character.is_control() && !"<>:\"|?*".contains(*character))
        .collect();
    let cleaned = cleaned.trim().trim_end_matches('.');
    if cleaned.is_empty() {
        "untitled.html".to_string()
    } else if cleaned.to_ascii_lowercase().ends_with(".html")
        || cleaned.to_ascii_lowercase().ends_with(".htm")
    {
        cleaned.to_string()
    } else {
        format!("{cleaned}.html")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filename_cannot_suggest_a_different_directory() {
        assert_eq!(suggested_filename("C:\\private\\page.html"), "page.html");
        assert_eq!(suggested_filename("../../page.html"), "page.html");
        assert_eq!(suggested_filename(""), "untitled.html");
        assert_eq!(suggested_filename("draft"), "draft.html");
    }
}
