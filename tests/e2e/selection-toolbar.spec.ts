import {test,expect} from '@playwright/test';
async function settings(page:import('@playwright/test').Page){await page.locator('.web-settings:not(.web-files):not(.web-editing) summary').click();await page.getByRole('button',{name:'应用设置…'}).click();await page.getByRole('button',{name:'编辑器',exact:true}).click();}
async function selectText(page:import('@playwright/test').Page){await page.locator('.ProseMirror').click();await page.keyboard.press('Home');await page.keyboard.press('Shift+End');}
test('selection toolbar defaults off, persists opt-in, formats selection and can be disabled',async({page})=>{
  await page.goto('/');await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'format.md',mimeType:'text/markdown',buffer:Buffer.from('选中的文字\n')});await selectText(page);
  const bar=page.getByRole('toolbar',{name:'选中文字格式'});await expect(bar).toHaveCount(0);
  await settings(page);const toggle=page.getByRole('checkbox',{name:/选中文字时显示格式工具栏/});await expect(toggle).not.toBeChecked();await toggle.check();await page.getByRole('button',{name:'关闭设置'}).click();await selectText(page);await expect(bar).toBeVisible();await page.keyboard.press('Meta+a');await expect(bar).toBeVisible();
  await bar.getByRole('button',{name:'加粗',exact:true}).click();await expect(page.locator('.ProseMirror strong')).toHaveText('选中的文字');await expect(bar.getByRole('button',{name:'加粗',exact:true})).toHaveAttribute('aria-pressed','true');
  await bar.getByRole('button',{name:'删除线',exact:true}).click();await expect(page.locator('.ProseMirror del')).toHaveText('选中的文字');
  await bar.getByRole('button',{name:'清除格式',exact:true}).click();await expect(page.locator('.ProseMirror strong')).toHaveCount(0);await expect(page.locator('.ProseMirror del')).toHaveCount(0);
  await bar.getByRole('button',{name:'加粗',exact:true}).click();await expect(page.getByText('草稿已保存')).toBeVisible();await page.reload();await selectText(page);await expect(bar).toBeVisible();await expect(page.locator('.ProseMirror strong')).toHaveText('选中的文字');await page.screenshot({path:'test-results/selection-toolbar.png'});
  await page.keyboard.press('Escape');await expect(bar).toHaveCount(0);
  await settings(page);await toggle.uncheck();await page.getByRole('button',{name:'关闭设置'}).click();await selectText(page);await expect(bar).toHaveCount(0);
});

test('text color and highlight survive save/reload, preview and clearing',async({page})=>{
  await page.goto('/');await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'colors.md',mimeType:'text/markdown',buffer:Buffer.from('彩色文字\n')});
  await settings(page);await page.getByRole('checkbox',{name:/选中文字时显示格式工具栏/}).check();await page.getByRole('button',{name:'关闭设置'}).click();await selectText(page);
  const bar=page.getByRole('toolbar',{name:'选中文字格式'});
  await bar.getByRole('button',{name:'加粗',exact:true}).click();
  await bar.getByRole('button',{name:'文字颜色',exact:true}).click();await bar.getByRole('button',{name:'红色',exact:true}).click();
  await bar.getByRole('button',{name:'背景高亮',exact:true}).click();await bar.getByRole('button',{name:'浅黄',exact:true}).click();
  await expect(page.locator('.ProseMirror span[style*="color: rgb(212"]')).toHaveText('彩色文字');
  await expect(page.locator('.ProseMirror span[style*="background-color"]')).toHaveCSS('background-color','rgb(255, 242, 168)');
  await expect(page.getByText('草稿已保存')).toBeVisible();await page.reload();
  await expect(page.locator('.ProseMirror strong')).toHaveText('彩色文字');
  await expect(page.locator('.ProseMirror span[style*="background-color"]')).toHaveCSS('background-color','rgb(255, 242, 168)');
  await page.getByRole('button',{name:'公众号预览',exact:true}).click();
  await expect(page.locator('[data-testid="wechat-preview"] span[style*="background-color"]')).toHaveCSS('background-color','rgb(255, 242, 168)');
  await selectText(page);await bar.getByRole('button',{name:'文字颜色',exact:true}).click();await page.screenshot({path:'test-results/text-colors.png'});
  await bar.getByRole('button',{name:'恢复默认',exact:true}).click();await expect(page.locator('.ProseMirror span[style^="color:"]')).toHaveCount(0);await expect(page.locator('.ProseMirror span[style*="background-color"]')).toHaveCount(1);
  await bar.getByRole('button',{name:'清除格式',exact:true}).click();await expect(page.locator('.ProseMirror span[style]')).toHaveCount(0);
});

test('paragraph alignment survives source, reload and preview; extended tools retain selection',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('size-md-preferences-v1',JSON.stringify({selectionToolbar:true})));
  await page.goto('/');
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'align.md',mimeType:'text/markdown',buffer:Buffer.from('## 居中标题\n\n普通段落\n')});
  const heading=page.locator('.ProseMirror h2');
  await heading.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const sel=window.getSelection()!;sel.removeAllRanges();sel.addRange(range);(el.closest('.ProseMirror') as HTMLElement).focus();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
  const bar=page.getByRole('toolbar',{name:'选中文字格式'});
  await bar.getByRole('button',{name:'居中',exact:true}).click();
  await expect(heading).toHaveCSS('text-align','center');
  await expect(bar.getByRole('button',{name:'居中',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:'test-results/expanded-selection-toolbar.png'});
  await page.getByRole('button',{name:'Markdown',exact:true}).click();
  await expect(page.locator('.cm-content')).toContainText('<div align="center">');
  await page.getByRole('button',{name:'即时编辑',exact:true}).click();
  await expect(heading).toHaveCSS('text-align','center');
  await expect(page.getByText('草稿已保存')).toBeVisible();await page.reload();
  await expect(heading).toHaveCSS('text-align','center');
  await page.getByRole('button',{name:'公众号预览',exact:true}).click();
  await expect(page.getByTestId('wechat-preview').locator('h2')).toHaveCSS('text-align','center');
  await heading.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const sel=window.getSelection()!;sel.removeAllRanges();sel.addRange(range);(el.closest('.ProseMirror') as HTMLElement).focus();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
  await bar.getByRole('combobox',{name:'选区段落样式'}).click();
  await page.getByRole('option',{name:'三级标题',exact:true}).click();
  await expect(page.locator('.ProseMirror h3')).toHaveText('居中标题');
  await expect(page.locator('.ProseMirror h3')).toHaveCSS('text-align','center');
});

test('multiple list paragraphs align together and remain editable after source round trip',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('size-md-preferences-v1',JSON.stringify({selectionToolbar:true})));
  await page.goto('/');
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'lists.md',mimeType:'text/markdown',buffer:Buffer.from('- 第一项\n- 第二项\n')});
  await page.locator('.ProseMirror').click();await page.keyboard.press('Meta+a');
  const bar=page.getByRole('toolbar',{name:'选中文字格式'});
  await bar.getByRole('button',{name:'右对齐',exact:true}).click();
  await expect(page.locator('.ProseMirror li p').first()).toHaveCSS('text-align','right');
  await expect(page.locator('.ProseMirror li p').last()).toHaveCSS('text-align','right');
  await page.keyboard.press('Meta+z');
  await expect(page.locator('.ProseMirror li p').first()).not.toHaveCSS('text-align','right');
  await bar.getByRole('button',{name:'居中',exact:true}).click();
  await page.getByRole('button',{name:'Markdown',exact:true}).click();
  await page.getByRole('button',{name:'即时编辑',exact:true}).click();
  await expect(page.locator('.ProseMirror li p')).toHaveCount(2);
  await expect(page.locator('.ProseMirror li p').first()).toHaveCSS('text-align','center');
  await expect(page.locator('.ProseMirror li p').last()).toHaveCSS('text-align','center');
  await bar.getByRole('button',{name:'更多段落工具',exact:true}).click();
  await expect(bar.getByRole('button',{name:'增加缩进',exact:true})).toBeEnabled();
  await page.screenshot({path:'test-results/selection-more-tools.png'});
});

test('table alignment uses standard Markdown column syntax',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('size-md-preferences-v1',JSON.stringify({selectionToolbar:true})));
  await page.goto('/');
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'table.md',mimeType:'text/markdown',buffer:Buffer.from('| 名称 | 状态 |\n| --- | --- |\n| 第一项 | 完成 |\n')});
  await page.locator('.ProseMirror td').first().evaluate(el=>{const range=document.createRange();range.selectNodeContents(el.querySelector('p')!);const sel=window.getSelection()!;sel.removeAllRanges();sel.addRange(range);(el.closest('.ProseMirror') as HTMLElement).focus();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
  const bar=page.getByRole('toolbar',{name:'选中文字格式'});
  await expect(bar.getByRole('button',{name:'两端对齐',exact:true})).toBeDisabled();
  await bar.getByRole('button',{name:'居中',exact:true}).click();
  await expect(page.locator('.ProseMirror th').first()).toHaveCSS('text-align','center');
  await page.getByRole('button',{name:'Markdown',exact:true}).click();
  await expect(page.locator('.cm-content')).toContainText(':');
  await expect(page.locator('.cm-content')).not.toContainText('<div');
  await page.getByRole('button',{name:'即时编辑',exact:true}).click();
  await expect(page.locator('.ProseMirror td').first()).toContainText('第一项');
});

test('center aligns the entire themed heading badge',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('size-md-preferences-v1',JSON.stringify({selectionToolbar:true})));
  await page.goto('/');
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'badge.md',mimeType:'text/markdown',buffer:Buffer.from('## 标题色块\n')});
  await page.locator('input[accept=".css"]').setInputFiles({name:'badge.css',mimeType:'text/css',buffer:Buffer.from('#write h2 { display: inline-block; padding: 8px 16px; background-color: #eee; }')});
  await page.locator('.ProseMirror h2').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const sel=window.getSelection()!;sel.removeAllRanges();sel.addRange(range);(el.closest('.ProseMirror') as HTMLElement).focus();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
  await page.getByRole('toolbar',{name:'选中文字格式'}).getByRole('button',{name:'居中',exact:true}).click();
  await expect.poll(()=>page.locator('.ProseMirror h2').evaluate(el=>{const rect=el.getBoundingClientRect(),parent=el.parentElement!.getBoundingClientRect();return Math.abs((rect.left+rect.right)/2-(parent.left+parent.right)/2);})).toBeLessThan(2);
});
