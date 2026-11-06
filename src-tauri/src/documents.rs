use std::path::Path;
use tauri_plugin_fs::FsExt;

#[tauri::command]
pub fn rename_document(app: tauri::AppHandle, path: String, name: String) -> Result<String, String> {
    if name.trim().is_empty() || name.contains(['/', '\\', ':']) || name == "." || name == ".." {
        return Err("文件名不能为空，也不能包含路径分隔符。".into());
    }
    let source = Path::new(&path);
    if !app.fs_scope().is_allowed(source) { return Err("请先通过文件菜单打开或保存该文件。".into()); }
    if !source.is_file() { return Err("原文件不存在，请重新保存文章。".into()); }
    let target = source.with_file_name(name);
    if target == source { return Ok(path); }
    app.fs_scope().allow_file(&target).map_err(|e| e.to_string())?;
    // Create without overwriting any existing destination, then remove the old name.
    std::fs::hard_link(source, &target).map_err(|e| format!("无法重命名（请检查是否有同名文件）：{e}"))?;
    if let Err(e) = std::fs::remove_file(source) {
        let _ = std::fs::remove_file(&target);
        return Err(format!("重命名失败：{e}"));
    }
    Ok(target.to_string_lossy().into_owned())
}

use std::{ffi::{CStr, CString, c_char, c_void}, sync::OnceLock};
use tauri::Emitter;
static APP: OnceLock<tauri::AppHandle> = OnceLock::new();
extern "C" { fn size_md_show_title(window: *mut c_void, name: *const c_char, path: *const c_char, id: *const c_char, x: f64, y: f64, width: f64, height: f64, callback: extern "C" fn(*const c_char)); }
extern "C" fn title_result(json: *const c_char) {
    if let Some(app) = APP.get() {
        let text = unsafe { CStr::from_ptr(json) }.to_string_lossy();
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) { let _ = app.emit("document-title-result", value); }
    }
}
#[tauri::command]
pub fn show_document_title(app: tauri::AppHandle, window: tauri::WebviewWindow, name: String, path: String, id: String, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    let _ = APP.set(app);
    let name = CString::new(name).map_err(|e| e.to_string())?;
    let path = CString::new(path).map_err(|e| e.to_string())?;
    let id = CString::new(id).map_err(|e| e.to_string())?;
    let handle = window.ns_window().map_err(|e| e.to_string())? as usize;
    window.run_on_main_thread(move || unsafe { size_md_show_title(handle as *mut c_void, name.as_ptr(), path.as_ptr(), id.as_ptr(), x,y,width,height,title_result); }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn prepare_document_directory(app: tauri::AppHandle, path: String) -> Result<String, String> {
    use tauri::Manager;
    let target = if path.starts_with("~/") { app.path().home_dir().map_err(|e|e.to_string())?.join(&path[2..]) } else { std::path::PathBuf::from(path) };
    if !target.is_absolute() { return Err("请输入绝对路径或 ~/ 开头的目录。".into()); }
    std::fs::create_dir_all(&target).map_err(|e|format!("无法创建保存目录：{e}"))?;
    Ok(target.canonicalize().map_err(|e|e.to_string())?.to_string_lossy().into_owned())
}
extern "C" { fn size_md_export_pdf(view: *mut c_void, path: *const c_char, width:f64, height:f64, margin:f64, callback:extern "C" fn(bool,*mut c_void), context:*mut c_void); }
extern "C" fn pdf_finished(ok:bool, context:*mut c_void) {
    let sender=unsafe{Box::from_raw(context as *mut std::sync::mpsc::Sender<bool>)};
    let _=sender.send(ok);
}
#[tauri::command]
pub async fn export_pdf(app: tauri::AppHandle, window: tauri::WebviewWindow, path: String, paper: String, margin: f64) -> Result<(), String> {
    if !app.fs_scope().is_allowed(&path) { return Err("请先选择 PDF 保存位置。".into()); }
    if !margin.is_finite() || !(0.0..=40.0).contains(&margin) { return Err("页边距应为 0–40 mm。".into()); }
    let (width,height) = match paper.as_str() { "A4"=>(210.0,297.0), "A5"=>(148.0,210.0), "Letter"=>(215.9,279.4), _=>return Err("不支持的纸张尺寸。".into()) };
    let path=CString::new(path).map_err(|e|e.to_string())?;
    let (tx,rx)=std::sync::mpsc::channel();
    window.with_webview(move |webview| { unsafe{size_md_export_pdf(webview.inner() as *mut c_void,path.as_ptr(),width*72.0/25.4,height*72.0/25.4,margin*72.0/25.4,pdf_finished,Box::into_raw(Box::new(tx)) as *mut c_void)}; }).map_err(|e|e.to_string())?;
    let ok=tauri::async_runtime::spawn_blocking(move||rx.recv()).await.map_err(|e|e.to_string())?.map_err(|e|e.to_string())?;
    if ok {Ok(())} else {Err("PDF 导出取消或失败，请重试。".into())}
}
