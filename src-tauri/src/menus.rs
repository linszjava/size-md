use serde::Deserialize;
use std::collections::HashMap;
use tauri::{AppHandle, menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder, CheckMenuItemBuilder, PredefinedMenuItem}};

#[derive(Deserialize)]
pub struct ThemeEntry { id: String, name: String }

#[derive(Deserialize)]
struct Entry { id: Option<String>, label: Option<String>, key: Option<String>, gate: Option<String>, check: Option<bool>, separator: Option<bool>, children: Option<Vec<Entry>> }
fn group(app: &AppHandle, entry: &Entry, flags: &HashMap<String, bool>) -> tauri::Result<tauri::menu::Submenu<tauri::Wry>> {
    let mut builder = SubmenuBuilder::new(app, entry.label.as_deref().unwrap_or(""));
    for child in entry.children.as_deref().unwrap_or(&[]) {
        if child.separator.unwrap_or(false) { builder = builder.separator(); continue; }
        if child.children.is_some() { builder = builder.item(&group(app, child, flags)?); continue; }
        let id = child.id.as_deref().unwrap_or("");
        let enabled = child.gate.as_ref().map(|key| *flags.get(key).unwrap_or(&false)).unwrap_or(true);
        if child.check.unwrap_or(false) {
            let mut item = CheckMenuItemBuilder::with_id(id,child.label.as_deref().unwrap_or("")).enabled(enabled).checked(*flags.get(id).unwrap_or(&false));
            if let Some(key) = &child.key { item = item.accelerator(key); }
            builder = builder.item(&item.build(app)?);
        } else {
            let mut item = MenuItemBuilder::with_id(id,child.label.as_deref().unwrap_or("")).enabled(enabled);
            if let Some(key) = &child.key { item = item.accelerator(key); }
            builder = builder.item(&item.build(app)?);
        }
    }
    builder.build()
}
pub fn install(app: &AppHandle, imported: &[ThemeEntry], selected: &str, flags: &HashMap<String, bool>) -> tauri::Result<()> {
    let app_menu = SubmenuBuilder::new(app, "Size MD")
        .item(&PredefinedMenuItem::about(app, Some("关于 Size MD"), None)?)
        .separator().item(&MenuItemBuilder::with_id("storage-settings", "设置…").accelerator("CmdOrCtrl+,").build(app)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("隐藏 Size MD"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("隐藏其他应用"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("显示全部"))?)
        .separator().item(&PredefinedMenuItem::quit(app, Some("退出 Size MD"))?).build()?;
    let file = SubmenuBuilder::new(app, "文件")
        .item(&MenuItemBuilder::with_id("new", "新建文章").accelerator("CmdOrCtrl+N").build(app)?)
        .item(&MenuItemBuilder::with_id("open", "打开 Markdown…").accelerator("CmdOrCtrl+O").build(app)?)
        .item(&MenuItemBuilder::with_id("save", "保存").accelerator("CmdOrCtrl+S").build(app)?)
        .item(&MenuItemBuilder::with_id("save-as", "另存为…").accelerator("CmdOrCtrl+Shift+S").build(app)?)
        .text("rename", "重命名…").text("duplicate", "创建副本")
        .separator().text("export-pdf", "导出 PDF…").text("export-html", "导出 HTML…")
        .item(&MenuItemBuilder::with_id("copy-wechat", "复制公众号排版").enabled(*flags.get("can-copy").unwrap_or(&true)).build(app)?)
        .text("copy-markdown", "复制 Markdown 源码").separator()
        .item(&PredefinedMenuItem::close_window(app, Some("关闭窗口"))?).build()?;
    let edit = SubmenuBuilder::new(app, "编辑")
        .item(&MenuItemBuilder::with_id("undo", "撤销").accelerator("CmdOrCtrl+Z").build(app)?)
        .item(&MenuItemBuilder::with_id("redo", "重做").accelerator("CmdOrCtrl+Shift+Z").build(app)?).separator()
        .item(&PredefinedMenuItem::cut(app, Some("剪切"))?)
        .item(&PredefinedMenuItem::copy(app, Some("复制"))?)
        .item(&PredefinedMenuItem::paste(app, Some("粘贴"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("全选"))?).separator()
        .item(&MenuItemBuilder::with_id("find", "查找…").accelerator("CmdOrCtrl+F").build(app)?)
        .item(&MenuItemBuilder::with_id("replace", "查找并替换…").accelerator("CmdOrCtrl+Alt+F").build(app)?)
        .item(&MenuItemBuilder::with_id("find-next", "查找下一个").accelerator("CmdOrCtrl+G").build(app)?)
        .item(&MenuItemBuilder::with_id("find-prev", "查找上一个").accelerator("CmdOrCtrl+Shift+G").build(app)?).build()?;
    let entries: Vec<Entry> = serde_json::from_str(include_str!("../../src/lib/menu-items.json")).expect("valid menu catalogue");
    let paragraph = group(app, &entries[0], flags)?;
    let format = group(app, &entries[1], flags)?;
    let view = group(app, &entries[2], flags)?;
    let mut theme_menu = SubmenuBuilder::new(app, "主题");
    for (id, name) in [("gothic", "Gothic"), ("github", "GitHub"), ("newsprint", "Newsprint")] {
        theme_menu = theme_menu.item(&CheckMenuItemBuilder::with_id(format!("theme:{id}"), name).checked(selected == id).build(app)?);
    }
    if !imported.is_empty() { theme_menu = theme_menu.separator(); }
    for theme in imported {
        theme_menu = theme_menu.item(&CheckMenuItemBuilder::with_id(format!("theme:{}", theme.id), theme.name.replace('&', "&&")).checked(selected == theme.id).build(app)?);
    }
    let theme_menu = theme_menu.separator().text("import-theme", "导入主题…").build()?;
    let window = SubmenuBuilder::new(app, "窗口")
        .item(&PredefinedMenuItem::minimize(app, Some("最小化"))?)
        .item(&PredefinedMenuItem::maximize(app, Some("缩放"))?)
        .item(&PredefinedMenuItem::close_window(app, Some("关闭窗口"))?).build()?;
    let help = SubmenuBuilder::new(app, "帮助").text("help", "使用说明").build()?;
    let menu = MenuBuilder::new(app).items(&[&app_menu, &file, &edit, &paragraph, &format, &view, &theme_menu, &window, &help]).build()?;
    app.set_menu(menu)?;
    Ok(())
}

#[tauri::command]
pub fn sync_theme_menu(app: AppHandle, imported: Vec<ThemeEntry>, selected: String, flags: Option<HashMap<String, bool>>) -> Result<(), String> {
    install(&app, &imported, &selected, &flags.unwrap_or_default()).map_err(|e| e.to_string())
}
