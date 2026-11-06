import {test,expect} from '@playwright/test';
async function blank(page:import('@playwright/test').Page){await page.goto('/');await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'slash.md',mimeType:'text/markdown',buffer:Buffer.from('\n')});await page.locator('.ProseMirror').click();}
test('slash menu filters Chinese commands and executes heading and table',async({page})=>{
  await blank(page);const editor=page.locator('.ProseMirror');await page.keyboard.type('/');const menu=page.getByRole('listbox',{name:'斜杠命令'});await expect(menu).toBeVisible();await page.keyboard.insertText('标题');await expect(menu.getByRole('option')).toHaveCount(6);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.keyboard.insertText('二级标题内容');await expect(editor.locator('h2')).toHaveText('二级标题内容');await expect(menu).toBeHidden();
  await page.keyboard.press('Enter');await page.keyboard.type('/table');await page.keyboard.press('Enter');await expect(page.getByRole('dialog',{name:'插入表格'})).toBeVisible();await page.getByRole('dialog',{name:'插入表格'}).getByRole('button',{name:'插入',exact:true}).click();await expect(editor.locator('table')).toBeVisible();await expect(editor).not.toContainText('/table');
});
test('slash menu cancellation preserves text and does not trigger inside prose or code',async({page})=>{
  await blank(page);const editor=page.locator('.ProseMirror');const menu=page.getByRole('listbox',{name:'斜杠命令'});
  await page.keyboard.type('/');await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(editor).toHaveText('/');await page.keyboard.type('abc');await expect(menu).toBeHidden();await page.keyboard.press('Meta+a');await page.keyboard.type('https://example.com/path');await expect(menu).toBeHidden();
  await page.keyboard.press('Meta+a');await page.keyboard.type('/code');await page.keyboard.press('Enter');await page.keyboard.type('/table');await expect(editor.locator('pre')).toContainText('/table');await expect(menu).toBeHidden();
});
test('slash supports clicking commands, no matches, IME confirmation and image picker',async({page})=>{
  await blank(page);const menu=page.getByRole('listbox',{name:'斜杠命令'}),editor=page.locator('.ProseMirror');await page.keyboard.type('/xyzunknown');await expect(menu).toContainText('没有匹配命令');await page.keyboard.press('Meta+a');await page.keyboard.type('/todo');
  await editor.dispatchEvent('keydown',{key:'Enter',isComposing:true,keyCode:229});await expect(editor).toContainText('/todo');await expect(editor.locator('li')).toHaveCount(0);
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'todo-command.md',mimeType:'text/markdown',buffer:Buffer.from('\n')});await editor.click();await page.keyboard.type('/todo');
  await menu.getByRole('option',{name:'待办列表'}).click();await expect(editor.locator('li')).toBeVisible();await expect(editor).not.toContainText('/todo');
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'image-command.md',mimeType:'text/markdown',buffer:Buffer.from('\n')});await editor.click();await page.keyboard.type('/图片');const chooser=page.waitForEvent('filechooser');await menu.getByRole('option',{name:'图片',exact:true}).click();await chooser;await expect(editor).not.toContainText('/图片');
});
