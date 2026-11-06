import { test, expect } from '@playwright/test';
async function settings(page: import('@playwright/test').Page) {
  await page.locator('.web-settings:not(.web-files):not(.web-editing) summary').click();
  await page.getByRole('button', { name: '应用设置…' }).click();
}
test('preferences persist and inline extensions survive editing and export', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await settings(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('navigation')).toContainText('Markdown');
  await dialog.getByRole('checkbox', { name: /^下标 / }).check();
  await dialog.getByRole('checkbox', { name: /^上标 / }).check();
  await dialog.getByLabel('高亮', { exact: false }).check();
  await dialog.getByLabel('自动识别链接', { exact: false }).uncheck();
  await dialog.getByRole('combobox', {name:'标题样式'}).click();
  await page.getByRole('option', {name:'Setext（一级 = / 二级 -）'}).click();
  await dialog.getByRole('button', { name: '关闭设置' }).click();
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({ name: 'extensions.md', mimeType: 'text/markdown', buffer: Buffer.from('# 测试\n\nH~2~O X^2^ ==重点== https://example.com [链接](https://example.com)\n\n`H~2~O`\n') });
  const editor = page.locator('.ProseMirror');
  await expect(editor.locator('sub')).toHaveText('2');
  await expect(editor.locator('sup')).toHaveText('2');
  await expect(editor.locator('mark')).toHaveText('重点');
  await expect(editor.locator('a')).toHaveCount(1);
  await editor.locator('h1').click(); await page.keyboard.press('End'); await page.keyboard.insertText('改');
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('===');
  await expect(page.locator('.cm-content')).toContainText('H~2~O X^2^ ==重点==');
  await page.getByRole('button', { name: '公众号预览', exact: true }).click();
  await expect(page.getByTestId('wechat-preview').locator('sub')).toHaveText('2');
  await expect(page.getByTestId('wechat-preview').locator('mark')).toHaveText('重点');
  await expect(page.getByTestId('wechat-preview').locator('a')).toHaveCount(1);
  await expect(page.getByText('草稿已保存')).toBeVisible(); await page.reload();
  await settings(page); await expect(page.getByRole('dialog').getByRole('checkbox', { name: /^下标 / })).toBeChecked();
  await page.getByLabel('查找设置').fill('密钥');
  await expect(page.getByRole('heading', { name: '图片与存储' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('smart punctuation applies to typing and new articles inherit the current theme', async ({page}) => {
  await page.goto('/'); await settings(page);
  await page.getByLabel('输入时转换标点', {exact:false}).check();
  await page.getByRole('button', {name:'主题',exact:true}).click();
  await page.getByRole('dialog').getByRole('combobox', {name:'当前文章主题',exact:true}).click();
  await page.getByRole('option', {name:'Newsprint'}).click();
  await page.getByRole('button', {name:'关闭设置'}).click();
  await page.locator('.web-files summary').click(); await page.getByRole('button',{name:'新建文章'}).click();
  await page.locator('.ProseMirror').click(); await page.keyboard.press('Meta+a'); await page.keyboard.type('Text...');
  await expect(page.locator('.ProseMirror')).toContainText('Text…');
  await expect(page.getByText('草稿已保存')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('size-md-drafts-v1')!)[0].theme)).toBe('newsprint');
});

test('typed inline marks and list preferences retain valid Markdown', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('size-md-preferences-v1', JSON.stringify({ subscript: true, superscript: true, highlight: true, bullet: '+', orderedStyle: 'fixed' })));
  await page.goto('/');
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({ name:'lists.md', mimeType:'text/markdown', buffer:Buffer.from('- first\n- second\n\n1. one\n2. two\n\nEnd\n') });
  const editor = page.locator('.ProseMirror'); await editor.locator('p').last().click(); await page.keyboard.press('End');
  await page.keyboard.type(' H~2~O X^2^ ==key== ');
  await expect(editor.locator('sub')).toHaveText('2'); await expect(editor.locator('sup')).toHaveText('2'); await expect(editor.locator('mark')).toHaveText('key');
  await page.getByRole('button',{name:'Markdown',exact:true}).click();
  await expect(page.locator('.cm-content')).toContainText('+ first');
  await expect(page.locator('.cm-content')).toContainText('1. two');
  await expect(page.locator('.cm-content')).toContainText('H~2~O');
});

 test('custom choice menu supports keyboard and Escape without closing settings', async ({page}) => {
  await page.goto('/'); await settings(page);
  await page.getByRole('button', {name:'图像',exact:true}).click();
  const choice = page.getByRole('combobox', {name:'存储服务'});
  await choice.click();
  await expect(page.getByRole('listbox', {name:'存储服务'})).toBeVisible();
  await page.screenshot({path:'test-results/custom-choice.png'});
  await choice.press('End'); await choice.press('Enter');
  await expect(choice).toContainText('腾讯云 COS');
  await expect(page.getByLabel('区域', {exact:true})).toHaveValue('ap-guangzhou');
  await choice.click(); await choice.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.preferences select')).toHaveCount(0);
});

test('local image configuration defaults and persists a custom directory without cloud credentials', async ({page}) => {
  await page.goto('/'); await settings(page);
  await page.getByRole('button', {name:'图像',exact:true}).click();
  await expect(page.getByRole('combobox', {name:'存储服务'})).toContainText('本地存储');
  await expect(page.getByLabel('图片保存目录',{exact:true})).toHaveValue('~/Pictures/Size MD');
  await page.getByLabel('图片保存目录',{exact:true}).fill('/tmp/Size MD Images');
  await page.getByRole('button',{name:'保存配置',exact:true}).click();
  await page.reload(); await settings(page);
  await page.getByRole('button', {name:'图像',exact:true}).click();
  await expect(page.getByLabel('图片保存目录',{exact:true})).toHaveValue('/tmp/Size MD Images');
  await expect(page.getByLabel('Bucket',{exact:true})).toHaveCount(0);
});
