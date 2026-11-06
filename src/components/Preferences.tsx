import ThemeSettings, {type ThemeSettingsProps} from './ThemeSettings';
import { desktop } from '../lib/platform';
import ChoiceSelect from './ChoiceSelect';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FileText, PenLine, Image, Code2, Printer, Palette, Settings, X, Search } from 'lucide-react';
import type { Preferences as Values } from '../lib/preferences';
const categories = [
  { id: 'file', label: '文件', icon: FileText, terms: '新建 默认 保存 草稿' },
  { id: 'editor', label: '编辑器', icon: PenLine, terms: '拼写 行号 选中 格式 工具栏 加粗 删除线 导航栏' },
  { id: 'image', label: '图像', icon: Image, terms: '图片 存储 上传 OSS COS 密钥' },
  { id: 'markdown', label: 'Markdown', icon: Code2, terms: '语法 标题 列表 链接 公式 上标 下标 高亮 警报 图表 智能 标点 引号 严格' },
  { id: 'export', label: '导出', icon: Printer, terms: '公众号 代码 高亮 PDF 页面 页边距 分页' },
  { id: 'themes', label: '主题', icon: Palette, terms: 'Typora CSS 导入 目录 地址 默认 字号 外观' },
  { id: 'general', label: '通用', icon: Settings, terms: '启动 预览' },
];
type Props = Pick<ThemeSettingsProps,'themeOptions'|'selectedTheme'|'onSelectTheme'|'onRefreshThemes'|'onImportThemeFolder'> & { onExportPdf: () => void; values: Values; onChange: (patch: Partial<Values>) => void; onClose: () => void; children: ReactNode; busy: boolean; onImportTheme: () => void };
export default function Preferences({ values: v, onChange, onClose, children, busy, onImportTheme, onExportPdf, themeOptions, selectedTheme, onSelectTheme, onRefreshThemes, onImportThemeFolder }: Props) {
  const [tab, setTab] = useState('markdown');
  const [directoryError,setDirectoryError]=useState('');
  const [directory,setDirectory]=useState(v.saveDirectory);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    root.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => previousFocus.current?.focus();
  }, []);
  const visible = categories.filter(c => `${c.label} ${c.terms}`.toLowerCase().includes(query.toLowerCase().trim()));
  const active = visible.some(c => c.id === tab) ? tab : visible[0]?.id;
  const check = (key: keyof Values, label: string, hint?: string) => <label className="preference-check"><input type="checkbox" checked={Boolean(v[key])} onChange={e => onChange({ [key]: e.target.checked })}/><span>{label}{hint && <small>{hint}</small>}</span></label>;
  const unavailable = (label: string, example: string) => <label className="preference-check unavailable"><input type="checkbox" disabled checked={false} readOnly/><span>{label}<small>{example} · 尚未支持</small></span></label>;
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={root} className="settings-modal preferences" role="dialog" aria-modal="true" aria-labelledby="preferences-title" onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (e.key === 'Tab') {
      const items = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? []).filter(n => n.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}><header><div className="mac-window-controls" aria-label="设置窗口控制"><button type="button" className="mac-close-button" onClick={onClose} aria-label="关闭设置" title="关闭设置"><span><X size={9} strokeWidth={2.5}/></span></button><button type="button" className="mac-inactive-button" disabled aria-label="最小化（设置窗口不支持）"><span/></button><button type="button" className="mac-inactive-button" disabled aria-label="全屏（设置窗口不支持）"><span/></button></div><h2 id="preferences-title">设置</h2></header><div className="preferences-body"><nav className="preferences-nav" aria-label="设置分类"><div className="preferences-search"><Search size={14}/><input placeholder="查找…" aria-label="查找设置" value={query} onChange={e => setQuery(e.target.value)}/></div>{visible.map(c => <button key={c.id} aria-current={active === c.id ? 'page' : undefined} onClick={() => setTab(c.id)}><c.icon size={18}/>{c.label}</button>)}</nav><div className="preferences-content">
    {!active && <p>没有找到匹配的设置。</p>}
    {active === 'markdown' && <><h2>Markdown</h2><fieldset disabled={busy}><h3>Markdown 语法偏好</h3><p className="preference-help">即时编辑生成 Markdown 时使用；已有源码不会因修改设置立即重写。</p><label className="preference-check"><input type="checkbox" checked disabled readOnly/><span>严格模式<small>固定使用 CommonMark / GFM 规范。</small></span></label><label className="preference-row">标题样式<ChoiceSelect label="标题样式" value={v.headingStyle} onValueChange={value => onChange({ headingStyle: value as Values['headingStyle'] })}><option value="atx">atx (#)</option><option value="setext">Setext（一级 = / 二级 -）</option></ChoiceSelect></label><label className="preference-row">无序列表<ChoiceSelect label="无序列表" value={v.bullet} onValueChange={value => onChange({ bullet: value as Values['bullet'] })}><option>-</option><option>*</option><option>+</option></ChoiceSelect></label><label className="preference-row">有序列表<ChoiceSelect label="有序列表" value={v.orderedStyle} onValueChange={value => onChange({ orderedStyle: value as Values['orderedStyle'] })}><option value="increment">1. … 2. … 3. …</option><option value="fixed">1. … 1. … 1. …</option></ChoiceSelect></label><h3>Markdown 扩展语法</h3>{check('autoLink', '自动识别链接', '例如 https://example.com；不影响手动插入的链接。')}{unavailable('内联公式', '$LaTeX$')}{check('subscript', '下标', '例如 H~2~O')}{check('superscript', '上标', '例如 X^2^')}{check('highlight', '高亮', '例如 ==key==；上标、下标和高亮暂不混用加粗等格式。')}{unavailable('GitHub 风格警报框', '[!NOTE] 等警报样式')}{unavailable('图表', '序列图、流程图和 Mermaid 图')}<p className="preference-help">未支持的扩展不会提供无效开关；公式与图表仍可在源码模式保留。</p><h3>智能标点</h3>{check('smartPunctuation', '输入时转换标点', '将 ... 转成 …，-- 转成 —；代码中不转换。')}{check('smartQuotes', '智能引号', '将英文直引号转换为弯引号；代码中不转换。')}{busy && <p>图片上传完成后可修改编辑器设置。</p>}</fieldset></>}
    {active === 'file' && <><h2>文件</h2><h3>默认文件保存位置</h3><label>保存目录<div className="local-directory-row"><input aria-label="文件保存目录" value={directory} onChange={e=>setDirectory(e.target.value)} onBlur={()=>{const path=directory.trim();if(!/^(\/|~\/)/.test(path)){setDirectoryError('请输入绝对路径或 ~/ 开头的目录。');return;}setDirectoryError('');onChange({saveDirectory:path});}}/><button className="button" disabled={!desktop} onClick={async()=>{const {open}=await import('@tauri-apps/plugin-dialog');const path=await open({directory:true,multiple:false,title:'选择文件保存目录'});if(typeof path==='string'){setDirectory(path);setDirectoryError('');onChange({saveDirectory:path});}}}>选择文件夹…</button></div></label>{directoryError&&<p role="alert">{directoryError}</p>}<p className="preference-help">默认：~/Documents。用于首次保存、另存为和 PDF 导出；已有文件仍保存到原位置。路径编辑完成后自动保存。</p><h3>新建文章</h3><p className="preference-help">新建或打开文章时沿用当前文章的主题和字号。</p><h3>草稿保存</h3><p>编辑后自动保存草稿到本机。</p><p className="preference-help">使用“文件 → 保存”或 ⌘S 保存为 Markdown 文件。草稿自动保存不能替代文件备份。</p></>}
    {active === 'editor' && <><h2>编辑器</h2><fieldset disabled={busy}>{check('spellcheck', '启用拼写检查', '使用 macOS / 浏览器提供的拼写检查。')}{check('lineNumbers', '源码模式显示行号')}{check('articleToolbar', '显示文章顶部工具栏', '提供标题、引用、加粗、列表等常用操作，也可点击工具栏右侧关闭。')}{check('selectionToolbar', '选中文字时显示格式工具栏', '默认关闭。开启后可调整文字格式、颜色、段落样式和对齐，或使用更多列表、引用工具。')}</fieldset></>}
    {active === 'image' && children}
    {active === 'export' && <><h2>导出</h2><h3>PDF</h3><label className="preference-row">页面大小<ChoiceSelect label="PDF 页面大小" value={v.pdfPaper} onValueChange={value=>onChange({pdfPaper:value as Values['pdfPaper']})}><option value="A4">A4（210 × 297 mm）</option><option value="A5">A5（148 × 210 mm）</option><option value="Letter">Letter（216 × 279 mm）</option></ChoiceSelect></label><label className="preference-row">页边距（mm）<input type="number" aria-label="PDF 页边距" min="0" max="40" value={v.pdfMargin} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&n<=40)onChange({pdfMargin:n});}}/></label>{check('pdfHeadingBreak','按一级标题分页')}<p className="preference-help">使用当前文章主题、文字颜色和代码高亮。支持本地图片；远程图片需加载成功后导出。</p><button className="button" disabled={busy} onClick={onExportPdf}>导出当前文章为 PDF…</button><h3>公众号与 HTML</h3>{check('codeHighlight', '代码语法高亮', '应用于公众号预览、复制公众号排版和 HTML 导出。')}<p className="preference-help">通过“文件”菜单复制公众号排版或导出 HTML。发布前仍需在公众号后台保存并检查手机预览。</p></>}
    {active === 'themes' && <><ThemeSettings onImportThemeFolder={onImportThemeFolder} directory={v.themeDirectory} onDirectory={path=>onChange({themeDirectory:path})} onImport={onImportTheme} themeOptions={themeOptions} selectedTheme={selectedTheme} onSelectTheme={onSelectTheme} onRefreshThemes={onRefreshThemes}/></>}
    {active === 'general' && <><h2>通用</h2>{check('startWithPreview', '启动时显示公众号预览', '下次打开 Size MD 时生效。')}<p className="preference-help">偏好修改后自动保存。图像存储配置需单独点击“保存配置”。</p></>}
  </div></div></section></div>;
}
