import { test, expect } from '@playwright/test';

test('source switch preserves caret in repeated nested text and wraps long lines', async ({ page }) => {
  await page.goto('/');
  const source = '# 标题\n\n重复文字\n\n- 重复文字\n- 前缀 **加粗文字** 后缀\n\n> 重复文字\n\n' + '很长的一行内容'.repeat(100) + '\n';
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({ name: 'cursor.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
  const target = page.locator('.ProseMirror blockquote p');
  await expect(target).toHaveText('重复文字');
  await target.evaluate(element => {
    const range = document.createRange(); range.setStart(element.firstChild!, 2); range.collapse(true);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    (element.closest('.ProseMirror') as HTMLElement).focus();
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  await page.keyboard.insertText('光标测试');
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('size-md-drafts-v1') ?? '[]').find((d: {name: string}) => d.name === 'cursor')?.markdown)).toContain('> 重复光标测试文字');
  await expect(page.locator('.cm-content')).toHaveCSS('white-space', 'break-spaces');
  await page.screenshot({ path: 'test-results/source-refined.png' });
});

for (const scenario of [
  { name: 'bold', source: '## 标题\n\n前缀 **加粗文字** 后缀\n', selector: 'strong', expected: '**加粗光标文字**' },
  { name: 'table', source: '| 列一 | 列二 |\n| --- | --- |\n| 表格文字 | 重复文字 |\n', selector: 'tbody td:first-child p', expected: '表格光标文字' },
  { name: 'code', source: '```js\n代码文字\n```\n', selector: 'pre code', expected: '代码光标文字' },
]) {
  test(`source caret maps ${scenario.name}`, async ({ page }) => {
    await page.goto('/');
    await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({ name: `${scenario.name}.md`, mimeType: 'text/markdown', buffer: Buffer.from(scenario.source) });
    const target = page.locator(`.ProseMirror ${scenario.selector}`);
    await expect(target).toBeVisible();
    await target.evaluate(element => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); const text = walker.nextNode()!;
      const range = document.createRange(); range.setStart(text, 2); range.collapse(true);
      const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
      (element.closest('.ProseMirror') as HTMLElement).focus();
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await page.getByRole('button', { name: 'Markdown', exact: true }).click();
    await page.keyboard.insertText('光标');
    await expect(page.locator('.cm-content')).toContainText(scenario.expected);
  });
}

for (const scenario of [
  { name: 'blank HTML blocks', body: '<br />\n\n<br />\n\n目标文字\n', selector: 'p:last-child', expected: '目标光标文字' },
  { name: 'colored text', body: '<span style="color:#cc3344">目标文字</span>\n', selector: 'span[style]', expected: '>目标光标文字</span>' },
  { name: 'highlight extension', body: '前缀 ==目标文字== 后缀\n', selector: 'mark', expected: '==目标光标文字==' },
  { name: 'multiline quotation', body: '> 前一行\n> 目标文字\n', selector: 'blockquote p', expected: '> 目标光标文字' },
]) {
  test(`source caret handles ${scenario.name}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('size-md-preferences-v1', JSON.stringify({highlight:true,subscript:true,superscript:true})));
    await page.goto('/');
    const source = '# 标题\n\n重复段落\n\n' + scenario.body;
    await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({ name:'mapping.md',mimeType:'text/markdown',buffer:Buffer.from(source) });
    const target = page.locator(`.ProseMirror ${scenario.selector}`).last();
    await expect(target).toBeVisible();
    await target.evaluate((element, offset) => {
      const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT); let text=walker.nextNode()!; while (!text.textContent?.includes('目标文字') && walker.nextNode()) text=walker.currentNode;
      const range=document.createRange(); range.setStart(text,offset); range.collapse(true);
      const selection=window.getSelection()!; selection.removeAllRanges();selection.addRange(range);
      (element.closest('.ProseMirror') as HTMLElement).focus();
      element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    }, 2);
    await page.getByRole('button',{name:'Markdown',exact:true}).click();
    await expect(page.locator('.cm-content')).toBeFocused();
    await page.keyboard.insertText('光标');
    await expect(page.locator('.cm-content')).toContainText(scenario.expected);
  });
}

test('long document round trip retains selection, scroll and original source', async ({ page }) => {
  await page.goto('/');
  const source = '# 长文章\n\n' + Array.from({length:80},(_,i)=>`第 ${i} 段重复文字\n\n<br />\n\n`).join('') + '<span style="color:#cc3344">最终目标文字</span>\n';
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'long.md',mimeType:'text/markdown',buffer:Buffer.from(source)});
  const target = page.locator('.ProseMirror p').last();
  await target.scrollIntoViewIfNeeded();
  await target.evaluate(el=>{
    const text=el.querySelector('span')!.firstChild!;
    const range=document.createRange();range.setStart(text,2);range.setEnd(text,4);
    const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);
    (el.closest('.ProseMirror') as HTMLElement).focus();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  });
  await page.getByRole('button',{name:'Markdown',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('目标');
  await expect(page.locator('.cm-line').filter({hasText:'最终目标文字'})).toBeInViewport();
  await page.getByRole('button',{name:'即时编辑',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('目标');
  await expect(page.locator('.ProseMirror p').last()).toBeInViewport();
  await page.getByRole('button',{name:'Markdown',exact:true}).click();
  await page.keyboard.insertText('替换');
  await expect(page.locator('.cm-content')).toContainText('最终替换文字');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('size-md-drafts-v1')??'[]').find((d:{name:string})=>d.name==='long')?.markdown)).toBe(source.replace('最终目标文字','最终替换文字'));
});
