use std::{ffi::{c_char, CStr}, sync::Mutex};
static UPLOAD: Mutex<()> = Mutex::new(());
extern "C" {
    fn size_ipic(bytes: *const u8, length: usize, check_only: bool) -> *mut c_char;
    fn size_ipic_free(value: *mut c_char);
}
fn call(data: &[u8], check: bool) -> Result<String, String> {
    let _guard = UPLOAD.lock().map_err(|_| "iPic 上传服务不可用，请重启 Size MD。")?;
    let raw = unsafe { size_ipic(data.as_ptr(), data.len(), check) };
    if raw.is_null() { return Err("iPic 未返回结果。".into()); }
    let json = unsafe { CStr::from_ptr(raw).to_string_lossy().into_owned() };
    unsafe { size_ipic_free(raw); }
    let value: serde_json::Value = serde_json::from_str(&json).map_err(|_| "iPic 响应格式错误。")?;
    if let Some(error) = value["error"].as_str() { return Err(error.into()); }
    value["url"].as_str().map(String::from).ok_or("iPic 响应缺少网址。".into())
}
#[tauri::command]
pub async fn check_ipic() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| call(&[], true)).await.map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn upload_ipic(data: Vec<u8>) -> Result<String, String> {
    if data.is_empty() || data.len() > 15 * 1024 * 1024 { return Err("图片大小必须在 1 字节至 15 MB 之间。".into()); }
    tauri::async_runtime::spawn_blocking(move || call(&data, false)).await.map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn open_ipic_download() -> Result<(), String> {
    std::process::Command::new("/usr/bin/open").arg("https://toolinbox.net/iPic/").spawn().map_err(|e| e.to_string())?;
    Ok(())
}
