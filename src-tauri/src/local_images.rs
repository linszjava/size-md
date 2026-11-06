use std::{fs, io::Write, path::PathBuf};
use tauri::Manager;

fn directory(app: &tauri::AppHandle, value: &str) -> Result<PathBuf, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let path = if value.is_empty() || value == "~/Pictures/Size MD" { home.join("Pictures/Size MD") }
        else if let Some(rest) = value.strip_prefix("~/") { home.join(rest) } else { PathBuf::from(value) };
    if !path.is_absolute() { return Err("请选择绝对路径，或以 ~/ 开头的目录。".into()); }
    Ok(path)
}
fn registry(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("image-directories.json"))
}
fn directories(app: &tauri::AppHandle) -> Vec<PathBuf> {
    registry(app).ok().and_then(|p| fs::read(p).ok()).and_then(|data| serde_json::from_slice(&data).ok()).unwrap_or_default()
}
#[tauri::command]
pub fn default_image_directory(app: tauri::AppHandle) -> Result<String, String> {
    Ok(directory(&app, "")?.to_string_lossy().into_owned())
}
#[tauri::command]
pub fn configure_image_directory(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let dir = directory(&app, &path)?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建图片目录：{e}"))?;
    let dir = fs::canonicalize(dir).map_err(|e| e.to_string())?;
    let mut dirs = directories(&app);
    if !dirs.contains(&dir) {
        dirs.push(dir.clone());
        let record = registry(&app)?;
        fs::create_dir_all(record.parent().unwrap()).map_err(|e| e.to_string())?;
        fs::write(record, serde_json::to_vec(&dirs).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    }
    Ok(dir.to_string_lossy().into_owned())
}
fn extension(data: &[u8]) -> Result<&'static str, String> {
    if data.is_empty() || data.len() > 15 * 1024 * 1024 { return Err("图片大小需在 15 MB 以内。".into()); }
    if data.starts_with(b"\x89PNG\r\n\x1a\n") { Ok("png") }
    else if data.starts_with(b"\xff\xd8\xff") { Ok("jpg") }
    else if data.starts_with(b"GIF87a") || data.starts_with(b"GIF89a") { Ok("gif") }
    else if data.starts_with(b"RIFF") && data.get(8..12) == Some(b"WEBP") { Ok("webp") }
    else { Err("支持 PNG、JPEG、GIF、WebP 图片。".into()) }
}
#[tauri::command]
pub fn save_local_image(app: tauri::AppHandle, data: Vec<u8>, path: String) -> Result<String, String> {
    extension(&data)?;
    let dir = configure_image_directory(app, path)?;
    write_image(&data, &dir)
}
fn write_image(data: &[u8], dir: &str) -> Result<String, String> {
    let ext = extension(data)?;
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let target = PathBuf::from(dir).join(format!("image-{timestamp}.{ext}"));
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(|e| format!("无法写入图片目录：{e}"))?;
    if let Err(error) = file.write_all(data) { let _ = fs::remove_file(&target); return Err(error.to_string()); }
    Ok(target.to_string_lossy().into_owned())
}
#[tauri::command]
pub fn read_local_image(app: tauri::AppHandle, path: String) -> Result<Vec<u8>, String> {
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !directories(&app).iter().any(|dir| path.starts_with(dir)) { return Err("此图片不在已配置的本地图片目录内。".into()); }
    if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 15 * 1024 * 1024 { return Err("图片超过 15 MB。".into()); }
    let data = fs::read(path).map_err(|e| e.to_string())?;
    extension(&data)?;
    Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn writes_unique_files_without_changing_bytes() {
        let dir = std::env::temp_dir().join(format!("size-md-images-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let bytes = include_bytes!("../icons/icon.png");
        let a = write_image(bytes, dir.to_str().unwrap()).unwrap();
        let b = write_image(bytes, dir.to_str().unwrap()).unwrap();
        assert_ne!(a, b); assert_eq!(fs::read(&a).unwrap(), bytes); assert_eq!(fs::read(&b).unwrap(), bytes);
        assert!(write_image(b"invalid", dir.to_str().unwrap()).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test] fn rejects_non_images() { assert!(extension(b"<script>alert(1)</script>").is_err()); assert_eq!(extension(b"\x89PNG\r\n\x1a\nabc").unwrap(), "png"); }
}
