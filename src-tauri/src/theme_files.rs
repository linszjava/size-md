use std::{path::PathBuf,io::Write};
use tauri::Manager;
fn directory(app:&tauri::AppHandle,path:&str)->Result<PathBuf,String>{
 let target=if path.starts_with("~/"){app.path().home_dir().map_err(|e|e.to_string())?.join(&path[2..])}else{PathBuf::from(path)};
 if !target.is_absolute(){return Err("主题目录必须是绝对路径或 ~/ 开头的目录。".into());}
 std::fs::create_dir_all(&target).map_err(|e|e.to_string())?;
 target.canonicalize().map_err(|e|e.to_string())
}
#[derive(serde::Serialize)]
pub struct ThemeFile {name:String,css:String}
fn collect(root:&std::path::Path,dir:&std::path::Path,depth:usize,files:&mut Vec<ThemeFile>)->Result<(),String>{
 if depth>8 || files.len()>=300{return Ok(());}
 let mut entries=std::fs::read_dir(dir).map_err(|e|e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
 entries.sort_by_key(|e|e.file_name());
 for entry in entries {
  let kind=entry.file_type().map_err(|e|e.to_string())?;
  if entry.file_name().to_string_lossy().starts_with('.') {continue;}
  if kind.is_dir(){collect(root,&entry.path(),depth+1,files)?;}
  else if kind.is_file() && entry.path().extension().is_some_and(|s|s.eq_ignore_ascii_case("css")) {
   let css=expand_css(root,&entry.path(),&mut Vec::new()).unwrap_or_default();
   files.push(ThemeFile{name:entry.path().strip_prefix(root).unwrap().to_string_lossy().into_owned(),css});
  }
  if files.len()>=300{break;}
 } Ok(())
}
fn expand_css(root:&std::path::Path,path:&std::path::Path,stack:&mut Vec<PathBuf>)->Result<String,String>{
 let path=path.canonicalize().map_err(|e|e.to_string())?;
 if !path.starts_with(root)||stack.contains(&path)||stack.len()>8{return Err("主题引用越界、循环或嵌套过深".into());}
 if std::fs::metadata(&path).map_err(|e|e.to_string())?.len()>2*1024*1024{return Err("CSS 文件超过 2 MB".into());}
 let css=std::fs::read_to_string(&path).map_err(|e|e.to_string())?;stack.push(path.clone());
 let imports=regex::Regex::new(r#"(?im)@import\s+(?:url\(\s*["']?([^\s\)"']+)["']?\s*\)|["']([^"']+)["'])\s*;"#).unwrap();
 let mut output=String::new();let mut end=0;
 for cap in imports.captures_iter(&css){let m=cap.get(0).unwrap();output.push_str(&css[end..m.start()]);let relative=cap.get(1).or_else(||cap.get(2)).unwrap().as_str();
  if !relative.contains(':')&&!relative.starts_with('/') {output.push_str(&expand_css(root,&path.parent().unwrap().join(relative),stack)?);}
  if output.len()>8*1024*1024{return Err("主题展开后超过 8 MB".into());}end=m.end();
 }
 output.push_str(&css[end..]);stack.pop();Ok(resolve_assets(root,&path,&output))
}
fn resolve_assets(root:&std::path::Path,path:&std::path::Path,css:&str)->String {
 let urls=regex::Regex::new(r#"url\(\s*["']?([^\s\)"']+)["']?\s*\)"#).unwrap();
 urls.replace_all(css,|cap:&regex::Captures|{
  let relative=&cap[1];if relative.contains(':')||relative.starts_with('/')||relative.starts_with('#'){return cap[0].to_string();}
  let Ok(asset)=path.parent().unwrap().join(relative).canonicalize() else{return "url(none)".into()};
  if !asset.starts_with(root){return "url(none)".into();}
  let ext=asset.extension().unwrap_or_default().to_string_lossy().to_lowercase();
  if !["ttf","otf","woff","woff2","png","jpg","jpeg","gif","webp","svg"].contains(&ext.as_str()){return "url(none)".into();}
  let encoded=asset.to_string_lossy().bytes().map(|b|if b.is_ascii_alphanumeric()||b"-_.~/".contains(&b){(b as char).to_string()}else{format!("%{b:02X}")}).collect::<String>();
  format!("url(asset://localhost{encoded})")
 }).into_owned()
}
fn copy_package(source:&std::path::Path,target:&std::path::Path)->Result<(),String>{
 std::fs::create_dir_all(target).map_err(|e|e.to_string())?;
 for entry in std::fs::read_dir(source).map_err(|e|e.to_string())?{let entry=entry.map_err(|e|e.to_string())?;let kind=entry.file_type().map_err(|e|e.to_string())?;
  if kind.is_symlink(){continue;}
  let dest=target.join(entry.file_name());
  if kind.is_dir(){copy_package(&entry.path(),&dest)?;}else if kind.is_file(){std::fs::copy(entry.path(),dest).map_err(|e|e.to_string())?;}
 } Ok(())
}
#[tauri::command]
pub fn list_theme_files(app:tauri::AppHandle,path:String)->Result<Vec<ThemeFile>,String>{
 let dir=directory(&app,&path)?;app.asset_protocol_scope().allow_directory(&dir,true).map_err(|e|e.to_string())?;let mut files=Vec::new();collect(&dir,&dir,0,&mut files)?;Ok(files)
}
#[tauri::command]
pub fn read_theme_source(app:tauri::AppHandle,path:String)->Result<String,String>{
 use tauri_plugin_fs::FsExt;
 if !app.fs_scope().is_allowed(&path){return Err("请先选择主题文件".into());}
 let path=PathBuf::from(path).canonicalize().map_err(|e|e.to_string())?;
 app.asset_protocol_scope().allow_directory(path.parent().unwrap(),true).map_err(|e|e.to_string())?;
 expand_css(path.parent().unwrap(),&path,&mut Vec::new())
}
#[tauri::command]
pub fn import_theme_folder(app:tauri::AppHandle,source:String,target:String)->Result<usize,String>{
 use tauri_plugin_fs::FsExt;
 if !app.fs_scope().is_allowed(&source){return Err("请先选择主题文件夹".into());}
 let root=PathBuf::from(source).canonicalize().map_err(|e|e.to_string())?;
 let mut files=Vec::new();collect(&root,&root,0,&mut files)?;let count=files.iter().filter(|f|!f.css.is_empty()).count();
 if count==0{return Err("此文件夹内未找到可读取的 CSS 主题，请选择包含主题 CSS 和资源的完整文件夹。".into());}
 let destination=directory(&app,&target)?;
 if !root.starts_with(&destination){
  if destination.starts_with(&root){return Err("导入目录不能位于源主题文件夹内部。".into());}
  let name=root.file_name().unwrap().to_string_lossy();
  let mut dest=destination.join(name.as_ref());let mut n=1;
  while dest.exists(){dest=destination.join(format!("{name}-{n}"));n+=1;}
  if let Err(error)=copy_package(&root,&dest){let _=std::fs::remove_dir_all(&dest);return Err(error);}
 }
 app.asset_protocol_scope().allow_directory(&destination,true).map_err(|e|e.to_string())?;
 Ok(count)
}
#[tauri::command]
pub fn save_theme_file(app:tauri::AppHandle,path:String,name:String,css:String)->Result<String,String>{
 if name.is_empty()||name.contains(['/', '\\'])||!name.to_lowercase().ends_with(".css")||css.len()>2*1024*1024{return Err("请选择不超过 2 MB 的 CSS 主题文件。".into());}
 let dir=directory(&app,&path)?;let stem=name.strip_suffix(".css").unwrap_or(&name);
 for n in 0..1000{
  let candidate=if n==0{name.clone()}else{format!("{stem}-{n}.css")};let target=dir.join(&candidate);
  if std::fs::read_to_string(&target).ok().as_deref()==Some(&css){return Ok(candidate);}
  match std::fs::OpenOptions::new().write(true).create_new(true).open(target){Ok(mut file)=>{file.write_all(css.as_bytes()).map_err(|e|e.to_string())?;return Ok(candidate)},Err(e) if e.kind()==std::io::ErrorKind::AlreadyExists=>continue,Err(e)=>return Err(e.to_string())}
 }
 Err("同名主题过多，请重命名后再导入。".into())
}

#[cfg(test)]
mod tests {
 use super::*;
 #[test] fn package_copy_and_live_scan(){
  let root=std::env::temp_dir().join(format!("size-md-theme-test-{}",std::process::id()));let _=std::fs::remove_dir_all(&root);let source=root.join("source");let dest=root.join("copy");
  std::fs::create_dir_all(source.join("assets")).unwrap();
  std::fs::write(source.join("assets/font.woff2"),b"font bytes").unwrap();
  std::fs::write(source.join("assets/base.css"),"@font-face{font-family:test;src:url(font.woff2)} #write h2{color:red}").unwrap();
  std::fs::write(source.join("theme.css"),"@import './assets/base.css'; #write p{color:blue}").unwrap();
  copy_package(&source,&dest).unwrap();let dest=dest.canonicalize().unwrap();assert_eq!(std::fs::read(dest.join("assets/font.woff2")).unwrap(),b"font bytes");
  let mut files=Vec::new();collect(&dest,&dest,0,&mut files).unwrap();assert_eq!(files.len(),2);assert!(files.iter().find(|f|f.name=="theme.css").unwrap().css.contains("asset://localhost"));
  std::fs::write(dest.join("theme.css"),"#write p{color:green}").unwrap();std::fs::remove_file(dest.join("assets/base.css")).unwrap();
  files.clear();collect(&dest,&dest,0,&mut files).unwrap();assert_eq!(files.len(),1);assert!(files[0].css.contains("green"));
  std::fs::write(dest.join("theme.css"),"@import 'theme.css';").unwrap();assert!(expand_css(&dest,&dest.join("theme.css"),&mut Vec::new()).is_err());
  std::fs::remove_dir_all(root).unwrap();
 }
}

// WKWebView cannot reliably load font files through its custom URL scheme.
// Only read font assets inside the already-authorized theme asset scope.
#[tauri::command]
pub fn read_theme_font(app:tauri::AppHandle,path:String)->Result<tauri::ipc::Response,String>{
 let path=PathBuf::from(path).canonicalize().map_err(|e|e.to_string())?;
 if !app.asset_protocol_scope().is_allowed(&path){return Err("字体不在已授权的主题目录中".into());}
 let ext=path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
 if !["ttf","otf","woff","woff2"].contains(&ext.as_str()){return Err("不支持的字体格式".into());}
 if std::fs::metadata(&path).map_err(|e|e.to_string())?.len()>32*1024*1024{return Err("字体文件超过 32 MB".into());}
 Ok(tauri::ipc::Response::new(std::fs::read(path).map_err(|e|e.to_string())?))
}
