# Size MD

面向 macOS 的 Markdown 写作应用。React + TypeScript + Tauri 2 + Milkdown。

## 运行

需要 Node.js 22.12+。桌面开发还需要 Rust stable 和 Xcode Command Line Tools。

```sh
npm ci
npm run dev              # 浏览器预览 http://127.0.0.1:1420
npm run desktop          # Mac 桌面开发（先停止单独启动的 Vite）
npm run desktop:build    # 编译 .app / .dmg
```

桌面构建产物位于 `src-tauri/target/release/bundle/`。

## 下载

从 [GitHub Releases](https://github.com/linszjava/size-md/releases) 下载。`v-1.0.0` 提供 macOS 12+ Apple Silicon（M 系列）安装包；应用版本为 `1.0.0`。本版未经过 Apple Developer ID 签名及公证。

## 当前能力

- Milkdown 单栏即时编辑：标题、加粗、列表、引用、代码块、GFM 表格、撤销重做。
- CodeMirror 源码模式，自动折行、常驻滚动条，双向切换保留光标与选区。Markdown 文件打开 / 保存，Cmd+S，多个本地草稿。
- 可选的文章工具栏与选区浮动工具栏：文字格式、颜色、高亮、段落样式、四种对齐，以及列表、引用、代码块和链接操作。段落对齐使用 HTML 包装标记保存，表格对齐沿用 GFM。
- macOS 菜单已中文化，在「主题」选择 Gothic / GitHub / Newsprint，或「主题 → 导入主题…」导入 Typora CSS。默认沿用 Gothic；导入主题加入本机主题库，切换与重启后保留，可在不同文章复用。字号位于「显示」菜单。外围界面保持灰白、中性、紧凑；公众号预览默认收起。
- 同一份主题规则驱动正文 CSS 与导出内联样式；375px 公众号预览。
- 复制 `text/html` 和纯文本到剪贴板，导出独立 HTML。
- 图片支持本地目录、iPic、OSS V4 / COS。未配置云存储时使用 `~/Pictures/Size MD`，可自选目录；云上传通过内存完成，不创建本地附件。
- 上传失败保留内存预览，可重试、移除。重试会插入当前光标位置。未完成任务会阻止文档切换与公众号复制。
- 上传凭据通过 Rust 存入 macOS Keychain，不放入 localStorage 或 Markdown。

## 配置图片上传

在 Mac 桌面版左下角打开「图片与存储」。填写 OSS / COS、Bucket、区域、公开访问域名、目录前缀以及 AccessKey / SecretKey。COS 的 Bucket 包含 APPID，例如 `articles-1250000000`。使用专用、最小权限的长期上传密钥；当前不支持 STS 临时令牌。

访问域名填写 `https://img.example.com`，不含过期签名参数。图片对象需要能通过该域名匿名读取；应用不会改变 Bucket ACL。上传成功意味着存储服务接受了对象，不等于 CDN 域名已正确绑定；请实际打开生成的图片链接验证。

上传文件名由内容 SHA-256 决定，重试不会生成随机重复对象。删除文档里的图片引用不会删除云端图片。支持 PNG / JPEG / GIF / WebP，单图最多 15 MB。浏览器预览不接收密钥、不执行真实上传。

严格意义上的系统零落盘不在保证范围内：操作系统换页、剪贴板、WebView 网络缓存由平台管理。云上传流程不会把新粘贴的图片写成临时文件；本地存储模式会保存到所选图片目录。退出会丢失未上传成功的内存图片。

## 公众号工作流与边界

1. 编辑文章，设置主题，检查右侧预览。
2. 处理图片上传失败和发布检查提示。
3. 点击「复制公众号排版」，粘贴到公众号后台。
4. 保存微信草稿，检查图片是否成功转存，并使用微信手机预览核对正文、代码、表格。

**当前实现是富文本复制，不是直接调用微信公众号草稿 API。** 未接入公众号账号，也未完成平台端的样式保真验收。软件不会声称微信能保留任意 CSS。编辑区与导出均使用 highlight.js 代码高亮；公式、Mermaid、复杂 HTML 尚未转换成图片。外链可点击性取决于平台。宽表格需手机实测。

Typora CSS 仅接受已知正文选择器和排版属性；忽略远程字体、背景图片、脚本、伪元素、UI 样式、媒体查询、CSS 变量和任意布局属性。导入会显示忽略数量，需看预览确认结果。

即时编辑会规范化标准 Markdown 的语法表达，不保证源码字节级往返。含 YAML 元数据、原始 HTML、公式、Mermaid、脚注的导入文档自动留在源码模式，避免即时编辑器丢弃不支持的结构。即时编辑并未完整复刻 Typora 的光标内语法标记交互。

草稿及主题自动保存在本机 WebView/browser localStorage；应定期保存 `.md` 备份。`.md` 导出保留原文和图片外链，不携带 CSS；分享样式使用 HTML。文件名和文章内一级标题分开管理。浏览器与桌面版的草稿存储相互独立。

## 验证

```sh
npm run build
npm test
# 另一个终端启动 npm run dev；使用已安装的 Google Chrome
npx playwright test
cd src-tauri && cargo test --release
```

测试覆盖富文本样式展开、代码空白、表格结构、恶意 HTML / URL 清理、CSS 适配、即时标题转换、模式切换、草稿恢复、主题选择与导入主题库持久化、真实浏览器剪贴板、Markdown 下载、上传失败与图片字节不持久化。Rust 签名测试校验 OSS 官方示例的规范化请求哈希，并使用独立 Python HMAC 结果核对密钥推导与签名。真实 OSS / COS 上传、系统钥匙串授权和微信保存后效果仍需用户配置账号后验收。

## 代码结构

- `src/components/Writer.tsx`：Milkdown 编辑器与上传占位。
- `src/App.tsx`：文档、草稿、主题、预览、上传队列与设置。
- `src/lib/themes.ts`：共享排版规则、Typora CSS 兼容范围。
- `src/lib/render.ts`：Markdown → 清理 HTML → 高亮 → 内联样式。
- `src/lib/platform.ts`：Web / Tauri 文件、剪贴板与上传适配。
- `src-tauri/src/storage.rs`：Keychain、OSS V4、COS、内存上传。

## 实现参考

- [Milkdown](https://milkdown.dev/)
- [Tauri 2](https://v2.tauri.app/)
- [OSS V4 签名](https://help.aliyun.com/zh/oss/developer-reference/recommend-to-use-signature-version-4)
- [COS 请求签名](https://cloud.tencent.com/document/api/436/7778)

根据用户要求，本地版本适配其已安装 Typora 的 Gothic 主题：`src/themes/gothic.css`、`github.css`、`newsprint.css` 来自本机 Typora 主题目录，仅解析正文规则，未引入 Typora 编辑器代码。Gothic 使用的 TeX Gyre Adventor 字体及随附 GUST 许可保存在 `public/fonts/gothic/`。微信公众号不能保证加载桌面端嵌入字体，字体回退需实际验证。没有直接合入 doocs/md 代码。

界面入口：新建文章、打开 Markdown 位于「文件」菜单；侧栏通过「我的文章 / 大纲」切换内容，分隔线支持拖动和双击恢复。图片上传配置位于「Size MD → 设置…」（⌘,）的「图片与存储」分类，设置窗口可继续扩展配置分类。主题仍通过顶部「主题」选择。

文件标题：正文顶部居中显示名称，点击展开名称与位置面板。未落盘草稿修改标题；本次会话中已打开/保存的文件会同步重命名磁盘文件，拒绝覆盖同名目标。位置入口采用另存为，保留原文件。当前不支持 Finder 标签；文件路径绑定仅在当前会话保留，重启后需重新打开文件以恢复绑定。

macOS 文件名弹层使用 AppKit NSPopover、NSTextField 和 NSPopUpButton，Enter 或点击外部确认，Esc 取消。浏览器预览保留 HTML 回退面板。保存与复制公众号排版统一位于「文件」菜单；顶部只保留居中文件名与右上角图标工具，文章格式工具栏可在设置中开启或关闭。

菜单栏现为「Size MD / 文件 / 编辑 / 段落 / 格式 / 显示 / 主题 / 窗口 / 帮助」。段落与格式命令作用于即时编辑器的当前选区，源码模式下禁用；查找替换与撤销重做支持两种编辑模式。表格行列、任务状态、列表缩进会根据光标上下文启用。常用快捷键与 Typora 接近，例如 ⌘1–6 标题、⌘0 段落、⌘B 加粗、⌘I 斜体、⌘K 链接、⌘F 查找、⌘⌥F 替换、⌘⇧S 另存为。

公式块、脚注、内容目录和 YAML 插入菜单暂时禁用并标注；这些已有文档仍按源码保护规则处理。没有完整实现 Typora 所有功能。应用通过 Info.plist 声明简体中文，本机实测 WebKit 原生右键菜单（查询、翻译、拷贝等）已中文化，不替换原生菜单。
