import { IPicSettings } from './components/IPicSettings';
import { mountThemeFonts } from './lib/theme-fonts';
import { exportPdf } from './lib/pdf-export';
import ArticleToolbar from './components/ArticleToolbar';
import TablePicker from './components/TablePicker';
import ChoiceSelect from './components/ChoiceSelect';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView as SourceView } from '@codemirror/view';
import { sourceExtensions } from './lib/source-theme';
import { sourceActions } from './lib/source-actions';
import type { EditorActions, MenuFlags } from './lib/editor-actions';
import EditingMenu from './components/EditingMenu';
import { markdown as markdownLanguage } from '@codemirror/lang-markdown';
import { ArrowUpRight, Check, ChevronDown, Code2, TextCursorInput, FileText, ImagePlus, List, LoaderCircle, Maximize2, PanelLeftClose, Smartphone, Upload, X, AlertCircle, RotateCcw } from 'lucide-react';
import Writer from './components/Writer';
import Preferences from './components/Preferences';
import { readPreferences, preferencesKey, type Preferences as PreferenceValues } from './lib/preferences';
import DocumentTitle from './components/DocumentTitle';
import ResizeHandle from './components/ResizeHandle';
import { readThemeLibrary, themeLibraryKey, synchronizeThemes, themeDisplayName } from './lib/theme-library';
import { sample } from './sample';
import { themes, themeRules, rulesCss, importTyporaTheme, type ThemeId, type Rules } from './lib/themes';
import { renderArticle } from './lib/render';
import { documentHeadings } from './lib/headings';
import { requiresSourceMode } from './lib/source';
import { desktop, initialStorage, saveCredentials, uploadImage, copyArticle, saveMarkdown, download, type StorageConfig } from './lib/platform';

type Draft = { id: string; name: string; markdown: string; updated: number; theme: ThemeId; fontSize: number; custom: Rules; themeName?: string };
type UploadTask = { id: string; file: File; preview: string; state: 'uploading' | 'failed'; error?: string };
const key = 'size-md-drafts-v1';
function readDrafts(): Draft[] {
  try { const list = JSON.parse(localStorage.getItem(key) ?? 'null'); if (Array.isArray(list) && list.length && list.every(d => typeof d.markdown === 'string' && typeof d.id === 'string')) return list.map(d => ({ ...d, theme: themes.some(t => t.id === d.theme) ? d.theme : 'gothic', custom: d.themeName ? d.custom : {} })); } catch { /* start with sample */ }
  return [{ id: crypto.randomUUID(), name: '写作，从这里开始', markdown: sample, updated: Date.now(), theme: 'gothic', fontSize: 16, custom: {} }];
}
function readStorage(): StorageConfig { try { const saved = JSON.parse(localStorage.getItem('size-md-storage') ?? '{}'); return { ...initialStorage, ...saved, provider: saved.provider && (saved.provider === 'local' || saved.provider === 'ipic' || (saved.bucket && saved.publicUrl)) ? saved.provider : 'local' }; } catch { return initialStorage; } }
function readPanelWidth(key: string, fallback: number) {
  try { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) && value >= 180 && value <= 800 ? value : fallback; } catch { return fallback; }
}
export default function App() {
  const [preferences, setPreferences] = useState(readPreferences);
  const [sidebarWidth, setSidebarWidth] = useState(() => readPanelWidth('size-md-sidebar-width', 220));
  const [previewWidth, setPreviewWidth] = useState(() => readPanelWidth('size-md-preview-width', 425));
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => { const resize = () => setWindowWidth(window.innerWidth); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  useEffect(() => { const timer = setTimeout(() => { try { localStorage.setItem('size-md-sidebar-width', String(sidebarWidth)); localStorage.setItem('size-md-preview-width', String(previewWidth)); } catch { /* layout preference is optional */ } }, 200); return () => clearTimeout(timer); }, [sidebarWidth, previewWidth]);
  const [drafts, setDrafts] = useState(readDrafts);
  const [activeId, setActiveId] = useState(() => drafts[0].id);
  const current = drafts.find(d => d.id === activeId) ?? drafts[0];
  const [mode, setMode] = useState<'write' | 'source'>(() => requiresSourceMode(current.markdown) ? 'source' : 'write');
  const [editorKey, setEditorKey] = useState(0);
  const [library, setLibrary] = useState(() => readThemeLibrary(drafts));
  const [preview, setPreview] = useState(preferences.startWithPreview);
  const [focus, setFocus] = useState(false);
  const [settings, setSettings] = useState(false);
  const [editorFlags, setEditorFlags] = useState<MenuFlags>({});
  const [typewriter, setTypewriter] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [replacement, setReplacement] = useState('');
  const [tableOpen, setTableOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const editorActions = useRef<EditorActions | null>(null);
  const pendingWriterSelection = useRef<{ anchor: number; head: number } | null>(null);
  const takeWriterSelection = useCallback(() => { const selection = pendingWriterSelection.current; pendingWriterSelection.current = null; return selection; }, []);
  const getSourceSelection = useRef<((source: string) => { anchor: number; head: number }) | null>(null);
  const pendingSourceSelection = useRef<{ anchor: number; head: number } | null>(null);
  const onSourceSelection = useCallback((get: typeof getSourceSelection.current) => { getSourceSelection.current = get; }, []);
  const sourceView = useRef<SourceView | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const onActions = useCallback((actions: EditorActions | null) => { editorActions.current = actions; }, []);
  const onFlags = useCallback((flags: MenuFlags) => setEditorFlags(prev => JSON.stringify(prev) === JSON.stringify(flags) ? prev : flags), []);
  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen, replaceOpen]);
  const [sidebarTab, setSidebarTab] = useState<'articles' | 'outline'>('articles');
  const [storage, setStorage] = useState(readStorage);
  useEffect(() => { if (desktop) void import('@tauri-apps/api/core').then(({invoke}) => invoke<string>('default_image_directory')).then(path => setStorage(prev => prev.localDir === '~/Pictures/Size MD' ? { ...prev, localDir: path } : prev)).catch(() => {}); }, []);
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [credentialsBusy, setCredentialsBusy] = useState(false);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [toast, setToast] = useState('');
  const [localSaved, setLocalSaved] = useState(true);
  const [paths, setPaths] = useState<Record<string, string>>({});
  const insertRef = useRef<((text: string) => void) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const themeRef = useRef<HTMLInputElement>(null);
  const tasksRef = useRef(tasks); tasksRef.current = tasks;
  const busy = tasks.length > 0;
  const sidebarMax = Math.max(180, Math.min(480, windowWidth - (preview ? 660 : 480)));
  const shownSidebar = Math.min(sidebarWidth, sidebarMax);
  const previewMax = Math.max(280, Math.min(800, windowWidth - (!focus && windowWidth > 760 ? shownSidebar + 1 : 0) - 321));
  const shownPreview = Math.min(previewWidth, previewMax);
  const article = useMemo(() => renderArticle(current.markdown, current.theme, current.fontSize, current.custom, preferences), [current.markdown, current.theme, current.fontSize, current.custom, preferences]);
  const css = useMemo(() => rulesCss(themeRules(current.theme, current.fontSize, current.custom), !desktop), [current.theme, current.fontSize, current.custom]);
  const [themeAssetsReady, setThemeAssetsReady] = useState(false);
  useEffect(() => desktop && themeAssetsReady ? mountThemeFonts(current.custom, setToast) : undefined, [current.custom, themeAssetsReady]);
  const headings = useMemo(() => documentHeadings(current.markdown), [current.markdown]);
  const characters = current.markdown.replace(/\s/g, '').length;
  const update = useCallback((patch: Partial<Draft>) => setDrafts(prev => prev.map(d => d.id === activeId ? { ...d, ...patch, updated: Date.now() } : d)), [activeId]);
  const onReady = useCallback((fn: ((text: string) => void) | null) => { insertRef.current = fn; }, []);
  useEffect(() => {
    setLocalSaved(false);
    const timer = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(drafts)); setLocalSaved(true); }
      catch { setToast('草稿保存失败，请立即导出 Markdown 备份。'); }
    }, 400);
    return () => clearTimeout(timer);
  }, [drafts]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (!localSaved || tasksRef.current.length) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [localSaved]);

  async function save(saveAs = false, suggestedName = current.name) {
    try {
      const name = suggestedName.replace(/[\\/:*?"<>|]/g, '-') + '.md';
      const result = await saveMarkdown(current.markdown, name, saveAs ? null : paths[activeId] ?? null, preferences.saveDirectory);
      if (result) { if (desktop) { setPaths(prev => ({ ...prev, [activeId]: result })); update({ name: result.split('/').pop()!.replace(/\.[^.]+$/, '') }); } setToast('Markdown 已保存。主题保留在本机草稿中；带样式分享请导出 HTML。'); }
    } catch (e) { setToast(String(e)); }
  }
  async function renameDocument(value: string) {
    const name = value.trim().replace(/\.md$/i, '');
    if (!name || /[\\/:*?"<>|]/.test(name) || name === '.' || name === '..') throw new Error('请输入有效的文件名，不能包含 /、: 等特殊字符。');
    const path = paths[activeId];
    if (desktop && path && name !== current.name) {
      const { invoke } = await import('@tauri-apps/api/core');
      const extension = path.match(/\.[^/.]+$/)?.[0] ?? '.md';
      const target = await invoke<string>('rename_document', { path, name: name + extension });
      setPaths(prev => ({ ...prev, [activeId]: target }));
    }
    update({ name });
  }
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => {
    if (desktop) return;
    const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); void saveRef.current(); } };
    document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler);
  }, []);
  function newDraft(content = '# 无标题\n\n', name = '无标题文章', path?: string) {
    if (busy) { setToast('请先完成图片上传，或移除失败的上传任务。'); return; }
    const draft: Draft = { id: crypto.randomUUID(), name, markdown: content, updated: Date.now(), theme: current.theme, fontSize: current.fontSize, custom: structuredClone(current.custom), themeName: current.themeName };
    setDrafts(prev => [draft, ...prev]); setSidebarTab('articles'); setActiveId(draft.id); setMode(requiresSourceMode(content) ? 'source' : 'write');
    if (path) setPaths(prev => ({ ...prev, [draft.id]: path }));
  }
  async function openFile() {
    if (busy) return;
    if (!desktop) { fileRef.current?.click(); return; }
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({ multiple: false, filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }] });
      if (path) { const { readTextFile } = await import('@tauri-apps/plugin-fs'); newDraft(await readTextFile(path), path.split('/').pop()!.replace(/\.[^.]+$/, ''), path); }
    } catch (e) { setToast(String(e)); }
  }
  async function handleUpload(file: File): Promise<string | null> {
    const id = crypto.randomUUID(); const previewUrl = URL.createObjectURL(file);
    setTasks(prev => [...prev, { id, file, preview: previewUrl, state: 'uploading' }]);
    try {
      const url = await uploadImage(file, storage);
      setTasks(prev => prev.filter(t => t.id !== id)); URL.revokeObjectURL(previewUrl);
      return url;
    } catch (e) { setTasks(prev => prev.map(t => t.id === id ? { ...t, state: 'failed', error: String(e) } : t)); return null; }
  }
  async function retry(task: UploadTask) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, state: 'uploading', error: undefined } : t));
    try { const url = await uploadImage(task.file, storage); insertRef.current?.(`![${task.file.name.replace(/[\[\]]/g, '')}](${url})`); removeTask(task); }
    catch (e) { setTasks(prev => prev.map(t => t.id === task.id ? { ...t, state: 'failed', error: String(e) } : t)); }
  }
  function removeTask(task: UploadTask) { URL.revokeObjectURL(task.preview); setTasks(prev => prev.filter(t => t.id !== task.id)); }
  async function copy() {
    if (article.hasMissingImages || busy) { setToast('请先处理未上传的图片，再复制公众号排版。'); return; }
    try { await copyArticle(article.html, current.markdown); setToast('公众号排版已复制。粘贴后请保存草稿，并在微信手机预览中核对样式与图片。'); }
    catch { setToast('剪贴板写入失败，可使用「导出 HTML」，在浏览器打开后复制正文。'); }
  }
  async function applyTheme(cssText: string, name: string) {
    const result = importTyporaTheme(cssText);
    if (!Object.values(result.rules).some(values=>Object.keys(values).length)) throw new Error('没有找到可适配的正文样式。');
    ++themeScanVersion.current;
    if(desktop){const {invoke}=await import('@tauri-apps/api/core');name=await invoke<string>('save_theme_file',{path:preferences.themeDirectory,name,css:cssText});}
    setLibrary(prev => [...prev.filter(t => t.name !== name), { id: prev.find(t => t.name === name)?.id ?? `imported-${crypto.randomUUID()}`, name, rules: result.rules }]);
    update({ theme: 'gothic', custom: result.rules, themeName: name });
    setToast(`已适配 ${name}；忽略 ${result.skipped} 项不兼容规则。请核对预览。`);
  }
  async function importTheme(file: File) {
    try { await applyTheme(await file.text(), file.name); } catch (e) { setToast(String(e)); }
  }
  async function chooseThemeFile(cssOnly=false) {
    if (!desktop) { themeRef.current?.click(); return; }
    if(!cssOnly){await importThemeFolder();return;}
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({ multiple: false, filters: [{ name: '主题 CSS', extensions: ['css'] }] });
    if (path) { const {invoke}=await import('@tauri-apps/api/core'); await applyTheme(await invoke<string>('read_theme_source',{path}), path.split('/').pop()!); }
  }
  const themeScanVersion=useRef(0);
  const themeScanSucceeded=useRef(false);
  const themeDirectoryRef=useRef(preferences.themeDirectory);
  themeDirectoryRef.current=preferences.themeDirectory;
  async function refreshThemeDirectory(path=preferences.themeDirectory) {
    if(!desktop)return;
    const version=++themeScanVersion.current;
    const {invoke}=await import('@tauri-apps/api/core');
    const files=await invoke<{name:string;css:string}[]>('list_theme_files',{path});
    if(version!==themeScanVersion.current||path!==themeDirectoryRef.current)return;
    themeScanSucceeded.current=true;
    setThemeAssetsReady(true);
    setLibrary(previous=>synchronizeThemes(previous,files));
    return `${files.length} 个 CSS 文件已同步。`;
  }
  useEffect(()=>{
    if(!desktop)return;
    let disposed=false,running=false;
    const refresh=async()=>{if(disposed||running)return;running=true;try{await refreshThemeDirectory();}catch{/* A failed scan must not remove cached themes. */}finally{running=false;}};
    void refresh();const timer=setInterval(()=>void refresh(),1500);
    const focus=()=>void refresh();window.addEventListener('focus',focus);
    return()=>{disposed=true;++themeScanVersion.current;clearInterval(timer);window.removeEventListener('focus',focus);};
  },[preferences.themeDirectory]);
  useEffect(()=>{
    if(!desktop||!themeScanSucceeded.current)return;
    setDrafts(previous=>{let changed=false;const next=previous.map(d=>{
      if(!d.themeName)return d;
      const theme=library.find(t=>t.name===d.themeName);
      if(theme&&JSON.stringify(theme.rules)===JSON.stringify(d.custom))return d;
      changed=true;return {...d,custom:theme?.rules??{},themeName:theme?.name};
    });return changed?next:previous;});
  },[library]);
  async function importThemeFolder(){
    const {open}=await import('@tauri-apps/plugin-dialog');const source=await open({directory:true,multiple:false,title:'选择 Typora 主题文件夹'});if(!source)return;
    const {invoke}=await import('@tauri-apps/api/core');const count=await invoke<number>('import_theme_folder',{source,target:preferences.themeDirectory});await refreshThemeDirectory();setToast(`完整主题包已导入（${count} 个样式文件），请选择主题。`);
  }
  function selectTheme(id: string) {
    const imported = library.find(t => t.id === id);
    if (imported) update({ theme: 'gothic', custom: imported.rules, themeName: imported.name });
    else if (themes.some(t => t.id === id)) update({ theme: id as ThemeId, custom: {}, themeName: undefined });
  }
  const themeOptions = [...themes, ...library].map(({ id, name }) => ({ id, name: themeDisplayName(name) }));
  const selectedTheme = library.find(t => t.name === current.themeName)?.id ?? current.theme;
  useEffect(() => {
    try { localStorage.setItem(themeLibraryKey, JSON.stringify(library)); } catch { setToast('主题库保存失败，请备份原始 CSS。'); }
  }, [library]);
  const menuFlags: MenuFlags = { ...editorFlags, rich: mode === 'write' && !busy, table: mode === 'write' && !busy && !!editorFlags.table, list: mode === 'write' && !busy && !!editorFlags.list, task: mode === 'write' && !busy && !!editorFlags.task, 'toggle-source': mode === 'source', 'toggle-sidebar': focus, 'toggle-preview': preview, typewriter, 'can-copy': !busy && !article.hasMissingImages };
  const menuFlagsKey = JSON.stringify(menuFlags);
  useEffect(() => {
    if (!desktop) return;
    const timer = setTimeout(() => { void import('@tauri-apps/api/core').then(({ invoke }) => invoke('sync_theme_menu', { imported: library.map(({ id, name }) => ({ id, name: themeDisplayName(name) })), selected: selectedTheme, flags: JSON.parse(menuFlagsKey) })).catch(e => setToast(String(e))); }, 100);
    return () => clearTimeout(timer);
  }, [library, selectedTheme, menuFlagsKey]);
  function activeActions() { return mode === 'write' ? editorActions.current : sourceView.current ? sourceActions(sourceView.current) : null; }
  function findText(backward = false) { if (!searchText) { setSearchOpen(true); return; } if (!activeActions()?.find(searchText,backward)) setToast('没有找到匹配文字。'); }
  function replaceText(all: boolean) { if (!searchText) return; const count = activeActions()?.replace(searchText,replacement,all) ?? 0; setToast(`已替换 ${count} 处。`); if (!all) findText(); }
  async function exportHtml() { const saved = await download(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="max-width:680px;margin:40px auto;padding:20px">${article.html}</body></html>`, `${current.name}.html`, 'text/html;charset=utf-8', preferences.saveDirectory); if (saved) setToast('已导出带内联样式的 HTML。'); }
  function toggleSource() {
    if (busy) return;
    if (mode === 'source' && requiresSourceMode(current.markdown)) { setToast('此文档包含暂不支持的语法，暂时保留源码编辑，以免转换时丢失内容。'); return; }
    if (mode === 'write') pendingSourceSelection.current = getSourceSelection.current?.(current.markdown) ?? null;
    else { const selection = sourceView.current?.state.selection.main; pendingWriterSelection.current = selection ? { anchor: selection.anchor, head: selection.head } : null; }
    setMode(mode === 'write' ? 'source' : 'write'); setEditorKey(v=>v+1);
  }
  const menuAction = useRef<(id: string) => Promise<void>>(async () => {});
  menuAction.current = async id => {
    try {
      if(id === 'ed:table') { if(mode === 'write' && !busy) { document.querySelectorAll('.web-editing details[open], .web-editing[open]').forEach(node=>node.removeAttribute('open')); setTableOpen(true); } return; }
      if (id.startsWith('ed:')) { if (mode !== 'write' || busy) return; if (!activeActions()?.run(id.slice(3))) setToast('此操作不适用于当前光标位置或选区。'); return; }
      if (id.startsWith('theme:')) { selectTheme(id.slice(6)); return; }
      switch (id) {
        case 'new': newDraft(); break;
        case 'open': await openFile(); break;
        case 'save': await save(); break;
        case 'save-as': await save(true); break;
        case 'rename': document.querySelector<HTMLButtonElement>('.document-title-button')?.click(); break;
        case 'duplicate': newDraft(current.markdown, `${current.name} 副本`); break;
        case 'export-pdf': if(await exportPdf(current.markdown,current.name,current.theme,current.fontSize,current.custom || {},preferences)) setToast(desktop ? 'PDF 已导出。' : '已打开打印窗口，可选择保存为 PDF。'); break;
        case 'export-html': await exportHtml(); break;
        case 'copy-markdown': if (desktop) { const {writeText} = await import('@tauri-apps/plugin-clipboard-manager'); await writeText(current.markdown); } else await navigator.clipboard.writeText(current.markdown); setToast('Markdown 源码已复制。'); break;
        case 'undo': case 'redo': activeActions()?.run(id); break;
        case 'find': setSearchOpen(true); setReplaceOpen(false); searchInput.current?.focus(); break;
        case 'replace': setSearchOpen(true); setReplaceOpen(true); searchInput.current?.focus(); break;
        case 'find-next': findText(); break;
        case 'find-prev': findText(true); break;
        case 'toggle-source': toggleSource(); break;
        case 'show-articles': setFocus(false); setSidebarTab('articles'); break;
        case 'show-outline': setFocus(false); setSidebarTab('outline'); break;
        case 'typewriter': setTypewriter(v=>!v); break;
        case 'fullscreen': if (desktop) { const {getCurrentWindow}=await import('@tauri-apps/api/window'); const win=getCurrentWindow(); await win.setFullscreen(!await win.isFullscreen()); } break;
        case 'insert-image': imageRef.current?.click(); break;
        case 'link-dialog': setLinkUrl('https://'); setLinkOpen(true); break;
        case 'copy-wechat': await copy(); break;
        case 'toggle-sidebar': setFocus(v => !v); break;
        case 'toggle-preview': setPreview(v => !v); break;
        case 'import-theme': case 'import-theme-direct': await chooseThemeFile(); break;
        case 'storage-settings': setSettings(true); break;
        case 'font-smaller': update({ fontSize: Math.max(14, current.fontSize - 1) }); break;
        case 'font-larger': update({ fontSize: Math.min(20, current.fontSize + 1) }); break;
        case 'font-reset': update({ fontSize: 16 }); break;
        case 'help': setToast('直接输入 Markdown 即时排版；在「主题」菜单切换或导入 CSS；「段落 / 格式」提供排版命令；复制公众号排版后粘贴到公众号编辑器。'); break;
      }
    } catch (e) { setToast(String(e)); }
  };
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import('@tauri-apps/api/event').then(({ listen }) => listen<string>('menu-action', event => { void menuAction.current(event.payload); })).then(fn => { if (disposed) fn(); else unlisten = fn; }).catch(e => setToast(String(e)));
    return () => { disposed = true; unlisten?.(); };
  }, []);

  return <div className={`app ${focus ? 'focus-mode' : ''} ${typewriter ? 'typewriter-mode' : ''}`} >
    <style>{css}</style>
    <input ref={fileRef} hidden type="file" accept=".md,.markdown,.txt" onChange={async e => { const file = e.target.files?.[0]; if (file) newDraft(await file.text(), file.name.replace(/\.[^.]+$/, '')); e.target.value = ''; }}/>
    <input ref={themeRef} hidden type="file" accept=".css" onChange={e => { const file = e.target.files?.[0]; if (file) void importTheme(file); e.target.value = ''; }}/>
    <input ref={imageRef} hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple onChange={async e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; for (const file of files) { const url = await handleUpload(file); if (url) insertRef.current?.(`![${file.name.replace(/[\[\]]/g, '')}](${url})`); } }}/>
    {!focus && <aside className="sidebar" style={{ width: shownSidebar }}>
      <div className="brand" data-tauri-drag-region><span>Size MD</span><button className="icon subtle" aria-label="专注模式" onClick={() => setFocus(true)}><PanelLeftClose size={17}/></button></div>
      <div className="sidebar-tabs" role="tablist" aria-label="侧栏内容"><button id="articles-tab" role="tab" aria-selected={sidebarTab === 'articles'} aria-controls="articles-panel" onClick={() => setSidebarTab('articles')}><FileText size={14}/> 我的文章</button><button id="outline-tab" role="tab" aria-selected={sidebarTab === 'outline'} aria-controls="outline-panel" onClick={() => setSidebarTab('outline')}><List size={14}/> 大纲</button></div>
      <div id="articles-panel" role="tabpanel" aria-labelledby="articles-tab" hidden={sidebarTab !== 'articles'} className="document-list">{drafts.map(d => <button key={d.id} className={`document ${d.id === activeId ? 'active' : ''}`} disabled={busy} onClick={() => { setActiveId(d.id); setMode(requiresSourceMode(d.markdown) ? 'source' : 'write'); setEditorKey(v => v + 1); }}><FileText size={17}/><span>{d.name}<small>{new Date(d.updated).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} · Markdown</small></span>{d.id === activeId && <i/>}</button>)}</div>
      <nav id="outline-panel" role="tabpanel" aria-labelledby="outline-tab" hidden={sidebarTab !== 'outline'} className="outline">{headings.length ? headings.map((h, i) => <button key={i} style={{ paddingLeft: `${12 + (h.level - 1) * 12}px` }} onClick={() => { const nodes = document.querySelectorAll('.editor-pane .article-content h1,.editor-pane .article-content h2,.editor-pane .article-content h3'); nodes[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>{h.text}</button>) : <p>输入标题后显示文章大纲</p>}</nav>

    </aside>}
    {!focus && <ResizeHandle label="调整侧栏宽度" value={shownSidebar} min={180} max={sidebarMax} onChange={setSidebarWidth} onReset={() => setSidebarWidth(220)}/>}
    <main className="workspace">
      <header className="topbar" data-tauri-drag-region><div className="breadcrumb">{focus && <button className="icon" aria-label="退出专注模式" onClick={() => setFocus(false)}><PanelLeftClose size={18}/></button>}</div><DocumentTitle id={activeId} onError={setToast} key={activeId} name={current.name} path={paths[activeId]} onRename={renameDocument} onSaveAs={name => save(true, name ?? current.name)}/><div className="toolbar">{!desktop && <details className="web-files web-settings"><summary>文件 <ChevronDown size={13}/></summary><div className="settings-menu" role="menu"><button onClick={e => { newDraft(); e.currentTarget.closest('details')?.removeAttribute('open'); }} disabled={busy}>新建文章</button><button onClick={() => void openFile()} disabled={busy}>打开 Markdown…</button><button onClick={() => void save()}>保存</button><button onClick={()=>void menuAction.current('export-pdf')}>导出 PDF…</button><button onClick={() => void copy()} disabled={busy || article.hasMissingImages}>复制公众号排版</button></div></details>}{!desktop && <EditingMenu flags={menuFlags} onAction={id => void menuAction.current(id)}/>}<div className="mode-switch"><button aria-label="即时编辑" title="即时编辑" aria-pressed={mode === 'write'} className={mode === 'write' ? 'selected' : ''} disabled={busy} onMouseDown={event => event.preventDefault()} onClick={() => { if (mode === 'source') toggleSource(); }}><TextCursorInput size={17} strokeWidth={1.4}/></button><button aria-label="Markdown" title="Markdown 源码" aria-pressed={mode === 'source'} className={mode === 'source' ? 'selected' : ''} disabled={busy} onMouseDown={event => event.preventDefault()} onClick={() => { if (mode !== 'source') toggleSource(); }}><Code2 size={16}/></button></div><div className="format-actions">{!desktop && <details className="web-settings"><summary>主题 <ChevronDown size={13}/></summary><div className="settings-menu" role="menu"><p>主题</p>{themeOptions.map(t => <button role="menuitemradio" aria-checked={selectedTheme === t.id} key={t.id} onClick={() => selectTheme(t.id)}>{t.name}{selectedTheme === t.id && <Check size={14}/>}</button>)}<button onClick={() => void chooseThemeFile().catch(e => setToast(String(e)))}><Upload size={14}/> 导入主题…</button><label className="font-label">正文字号 {current.fontSize}px<input aria-label="正文字号" type="range" min="14" max="20" value={current.fontSize} onChange={e => update({ fontSize: Number(e.target.value) })}/></label><button onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setSettings(true); }}>应用设置…</button></div></details>}<button disabled={mode !== 'write'} onClick={() => imageRef.current?.click()} title="插入图片" aria-label="插入图片"><ImagePlus size={17}/></button><button onClick={() => setFocus(!focus)} title="专注模式" aria-label="切换专注模式"><Maximize2 size={16}/></button><span className="divider"/><button aria-label="公众号预览" title="公众号预览" className={preview ? 'preview-active' : ''} onClick={() => setPreview(!preview)}><Smartphone size={16}/></button></div></div></header>
      {searchOpen && <div className="search-bar" role="search" onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false); }}><input ref={searchInput} aria-label="查找内容" placeholder="查找文字" value={searchText} onChange={e=>setSearchText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();findText(e.shiftKey);}}}/><button onClick={()=>findText(true)}>上一处</button><button onClick={()=>findText()}>下一处</button>{replaceOpen && <><input aria-label="替换内容" placeholder="替换为" value={replacement} onChange={e=>setReplacement(e.target.value)}/><button onClick={()=>replaceText(false)}>替换</button><button onClick={()=>replaceText(true)}>全部替换</button></>}<button aria-label="关闭查找" onClick={()=>setSearchOpen(false)}><X size={15}/></button></div>}
      {mode === 'write' && preferences.articleToolbar && <ArticleToolbar flags={menuFlags} disabled={busy} onCommand={id=>void menuAction.current(id)} onClose={()=>{const next={...preferences,articleToolbar:false};try{localStorage.setItem(preferencesKey,JSON.stringify(next));setPreferences(next);}catch{setToast('设置保存失败，请检查本机存储空间。');}}}/>}
      <div className="canvas"><section className={`editor-pane ${preview ? '' : 'wide'}`}>
        
        
        {mode === 'write' ? <Writer takeSelection={takeWriterSelection} onSourceSelection={onSourceSelection} onCommand={id=>void menuAction.current(id)} preferences={preferences} typewriter={typewriter} onActions={onActions} onFlags={onFlags} key={`${activeId}-${editorKey}-${preferences.headingStyle}-${preferences.bullet}-${preferences.orderedStyle}-${preferences.autoLink}-${preferences.smartPunctuation}-${preferences.smartQuotes}-${preferences.spellcheck}-${preferences.subscript}-${preferences.superscript}-${preferences.highlight}`} initial={current.markdown} onChange={text => update({ markdown: text })} onUpload={handleUpload} onReady={onReady}/> : <div className="source-editor"><p className="source-note">源码原样保存。切回即时编辑后，标准 Markdown 格式可能规范化；自定义语法建议在源码模式编辑。</p><CodeMirror onCreateEditor={view => { sourceView.current = view;
          const selection = pendingSourceSelection.current; pendingSourceSelection.current = null;
          if (selection) requestAnimationFrame(() => { if (view.dom.isConnected) { view.dispatch({ selection, effects: SourceView.scrollIntoView(selection.head, { y: 'center' }) }); view.focus(); } }); }} value={current.markdown} extensions={[markdownLanguage(), ...sourceExtensions]} onChange={value => update({ markdown: value })} basicSetup={{ foldGutter: false, syntaxHighlighting: false, highlightActiveLine: true, lineNumbers: preferences.lineNumbers }} height="100%" aria-label="Markdown 源码"/></div>}
        
      </section>
      {preview && <><ResizeHandle label="调整公众号预览宽度" value={shownPreview} min={280} max={previewMax} reverse onChange={setPreviewWidth} onReset={() => setPreviewWidth(425)}/><aside className="preview-pane" style={{ width: shownPreview }}><div className="preview-heading"><div><Smartphone size={15}/><span>公众号预览</span></div><span className="preview-badge">375 px</span></div><div className="phone-paper"><div data-testid="wechat-preview" dangerouslySetInnerHTML={{ __html: article.html }}/></div><div className="preview-note"><AlertCircle size={14}/><span>兼容样式预览 · 发布前请核对微信实际效果</span></div>{article.warnings.length > 0 && <details className="compatibility"><summary>{article.warnings.length} 项发布检查</summary>{article.warnings.map(w => <p key={w}>{w}</p>)}</details>}<button className="export-html" onClick={() => void exportHtml().catch(e => setToast(String(e)))}>导出 HTML <ArrowUpRight size={14}/></button></aside></>}
      </div>
      <footer className="statusbar"><span><span className="status-dot"/> {desktop ? 'Mac 桌面版' : '浏览器预览'} · {localSaved ? '草稿已保存' : '保存中…'} <span className="footer-divider">/</span> Markdown</span><span>{characters.toLocaleString()} 字符 <span className="footer-divider">·</span> 约 {Math.max(1, Math.ceil(characters / 450))} 分钟阅读 <span className="footer-divider">·</span> UTF-8</span></footer>
    </main>
    {tasks.length > 0 && <section className="upload-tray" aria-label="图片上传队列"><header>图片上传 <small>未上传图片仅保留在内存</small></header>{tasks.map(task => <div className="upload-task" key={task.id}><img src={task.preview} alt="待上传预览"/><div><strong>{task.file.name}</strong><small>{task.state === 'uploading' ? '正在上传…' : task.error}</small></div>{task.state === 'uploading' ? <LoaderCircle size={17} className="spin"/> : <><button className="icon" title="重试并插入当前光标位置" onClick={() => retry(task)}><RotateCcw size={16}/></button><button className="icon" title="移除上传任务" onClick={() => removeTask(task)}><X size={16}/></button></>}</div>)}</section>}
    {tableOpen && <TablePicker onClose={()=>setTableOpen(false)} onInsert={(rows,cols)=>{if(!editorActions.current?.run('table',`${rows},${cols}`))setToast('请将光标放在正文中再插入表格。');setTableOpen(false);}}/>}
    {linkOpen && <div className="modal-backdrop"><form className="link-dialog" role="dialog" aria-label="插入超链接" onSubmit={e=>{e.preventDefault();try { const url=new URL(linkUrl); if(!['https:','http:','mailto:'].includes(url.protocol)) throw new Error('请输入 HTTP、HTTPS 或 mailto 链接。'); editorActions.current?.run('link',linkUrl); setLinkOpen(false); } catch(e){setToast(String(e));}}}><h2>超链接</h2><input autoFocus aria-label="链接地址" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)}/><div><button type="button" onClick={()=>setLinkOpen(false)}>取消</button><button type="submit">插入</button></div></form></div>}
    {toast && <div className="toast" role="status"><AlertCircle size={17}/><span>{toast}</span><button className="icon" aria-label="关闭提示" onClick={() => setToast('')}><X size={15}/></button></div>}
    {settings && <Preferences onImportThemeFolder={()=>void importThemeFolder().catch(e=>setToast(String(e)))} themeOptions={themeOptions} selectedTheme={selectedTheme} onSelectTheme={selectTheme} onRefreshThemes={async()=>{try{setToast(await refreshThemeDirectory() || '浏览器预览中请使用导入按钮。');}catch(e){setToast(String(e));}}} onExportPdf={()=>void menuAction.current('export-pdf')} values={preferences} busy={busy} onClose={() => setSettings(false)} onImportTheme={() => void chooseThemeFile(true).catch(e => setToast(String(e)))} onChange={(patch: Partial<PreferenceValues>) => {
      const next = { ...preferences, ...patch };
      try { localStorage.setItem(preferencesKey, JSON.stringify(next)); setPreferences(next); } catch { setToast('设置保存失败，请检查本机存储空间。'); }
    }}><h2 id="storage-title">图片与存储</h2><p>选择图片保存方式。本地存储无需配置云服务；云端密钥保存在 Mac 系统钥匙串。</p><form onSubmit={async e => { e.preventDefault(); setCredentialsBusy(true); try { if (storage.provider === 'ipic') { if (!desktop) throw new Error('iPic 需要 Mac 桌面版。'); localStorage.setItem('size-md-storage', JSON.stringify(storage)); setSettings(false); setToast('已选择 iPic。粘贴图片将通过 iPic 上传并插入网址。'); return; } if (storage.provider === 'local') { let path = storage.localDir.trim(); if (!path.startsWith('/') && !path.startsWith('~/')) throw new Error('请输入绝对路径或以 ~/ 开头的目录。'); if (desktop) { const {invoke} = await import('@tauri-apps/api/core'); path = await invoke<string>('configure_image_directory', {path}); } const next = {...storage, localDir:path}; localStorage.setItem('size-md-storage', JSON.stringify(next)); setStorage(next); setSettings(false); setToast('本地图片存储配置已保存。'); return; } const url = new URL(storage.publicUrl); if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) throw new Error('图片访问域名必须是无签名参数的 HTTPS 地址。'); if (accessKey || secretKey) { if (!accessKey || !secretKey) throw new Error('请同时填写 AccessKey 和 SecretKey。'); await saveCredentials(accessKey.trim(), secretKey.trim()); } localStorage.setItem('size-md-storage', JSON.stringify(storage)); setAccessKey(''); setSecretKey(''); setSettings(false); setToast('存储配置已保存。Bucket 中的图片需允许匿名读取，或通过公开 CDN 访问。'); } catch (e) { setToast(String(e)); } finally { setCredentialsBusy(false); } }}><label>存储服务<ChoiceSelect label="存储服务" value={storage.provider} onValueChange={value => setStorage({ ...storage, provider: value as StorageConfig['provider'], region: value === 'oss' ? 'cn-hangzhou' : 'ap-guangzhou' })}><option value="local">本地存储</option><option value="oss">阿里云 OSS</option><option value="cos">腾讯云 COS</option><option value="ipic">iPic</option></ChoiceSelect></label>{storage.provider === 'ipic' ? <IPicSettings/> : storage.provider === 'local' ? <><label>图片保存目录<div className="local-directory-row"><input required aria-label="图片保存目录" value={storage.localDir} onChange={e => setStorage({...storage, localDir:e.target.value})}/><button type="button" className="button" disabled={!desktop} onClick={async () => { const {open} = await import('@tauri-apps/plugin-dialog'); const path = await open({directory:true, multiple:false, title:'选择图片保存目录'}); if (typeof path === 'string') setStorage({...storage, localDir:path}); }}>选择文件夹…</button></div></label><p className="settings-note">默认目录：~/Pictures/Size MD。粘贴、拖入或插入的图片会复制到此目录，Markdown 使用本地绝对路径。修改目录只影响之后插入的图片。</p><p className="settings-note">本地图片不能直接用于公众号。发布前请切换云存储并重新插入图片，生成 HTTPS 外链。</p></> : <><div className="form-row"><label>Bucket<input required value={storage.bucket} onChange={e => setStorage({ ...storage, bucket: e.target.value.trim() })} placeholder={storage.provider === 'oss' ? 'my-articles' : 'my-articles-1250000000'}/></label><label>区域<input required value={storage.region} onChange={e => setStorage({ ...storage, region: e.target.value.trim() })} placeholder="cn-hangzhou"/></label></div><label>图片公开访问域名<input required type="url" value={storage.publicUrl} onChange={e => setStorage({ ...storage, publicUrl: e.target.value.trim() })} placeholder="https://img.example.com"/></label><label>上传目录前缀<input value={storage.prefix} onChange={e => setStorage({ ...storage, prefix: e.target.value })} placeholder="size-md"/></label><div className="form-row"><label>AccessKey / SecretId<input disabled={!desktop} autoComplete="off" value={accessKey} onChange={e => setAccessKey(e.target.value)} placeholder="留空保留已存凭据"/></label><label>SecretKey<input disabled={!desktop} autoComplete="new-password" type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="仅存入系统钥匙串"/></label></div>{!desktop && <div className="settings-note">当前是浏览器预览。图片上传与密钥设置需使用 Mac 桌面版。</div>}<div className="settings-note">请使用专用、最小权限的上传密钥。无需将整个 Bucket 开放写入；软件不会修改存储桶权限。</div></>}<button className="button primary save-config" disabled={credentialsBusy}>{credentialsBusy ? '保存中…' : '保存配置'}</button></form></Preferences>}
  </div>;
}
