import {test,expect} from '@playwright/test';
test('custom table dimensions, automatic row, column controls, alignment and Markdown roundtrip',async({page})=>{
  await page.goto('/'); await page.locator('.web-files summary').click();await page.getByRole('button',{name:'新建文章',exact:true}).click();
  await page.locator('.ProseMirror').click();await page.keyboard.press('End');await page.keyboard.press('Enter');
  const menu=page.locator('.web-editing');await menu.locator(':scope > summary').click();await menu.locator('summary').filter({hasText:/^段落$/}).click();await menu.locator('summary').filter({hasText:/^表格$/}).click();await menu.getByRole('button',{name:'插入表格…',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'插入表格'});await dialog.getByLabel('行数').fill('2');await dialog.getByLabel('列数').fill('4');await dialog.getByRole('button',{name:'插入',exact:true}).click();
  const table=page.locator('.ProseMirror table');await expect(table.locator('tr')).toHaveCount(2);await expect(table.locator('tr').first().locator('th')).toHaveCount(4);
  await table.locator('td').last().click();await page.keyboard.insertText('末格');await page.keyboard.press('Tab');await expect(table.locator('tr')).toHaveCount(3);await page.keyboard.insertText('新行');await expect(table.locator('tr').last().locator('td').first()).toHaveText('新行');
  await page.getByRole('toolbar',{name:'表格工具'}).getByRole('button',{name:'右侧加列'}).click();await expect(table.locator('tr').last().locator('td')).toHaveCount(5);
  await page.getByRole('toolbar',{name:'表格工具'}).getByRole('button',{name:'列居中'}).click();await expect(table.locator('th').first()).toHaveCSS('text-align','center');
  await page.getByRole('button',{name:'Markdown',exact:true}).click();await expect(page.locator('.cm-content')).toContainText('末格');await expect(page.locator('.cm-content')).toContainText('新行');
  await page.getByRole('button',{name:'即时编辑',exact:true}).click();await expect(table.locator('tr')).toHaveCount(3);await expect(table.locator('th')).toHaveCount(5);
});

test('table-attached icon toolbar resizes safely and stays out of exported content',async({page})=>{
  await page.goto('/');
  await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'table.md',mimeType:'text/markdown',buffer:Buffer.from('| A | B |\n| - | - |\n| keep | data |\n\nAfter\n')});
  const table=page.locator('.ProseMirror table');await table.locator('td').first().click();
  const tools=page.getByRole('toolbar',{name:'表格工具'});await expect(tools).toBeVisible();
  await tools.getByRole('button',{name:'调整表格尺寸',exact:true}).click();
  const popup=page.getByRole('dialog',{name:'调整表格尺寸'});
  await popup.getByLabel('表格列数').fill('4');await popup.getByLabel('表格行数').fill('5');await popup.getByRole('button',{name:'应用尺寸'}).click();
  await expect(table.locator('tr')).toHaveCount(5);await expect(table.locator('th')).toHaveCount(4);await expect(table).toContainText('keep');
  await tools.getByRole('button',{name:'调整表格尺寸',exact:true}).click();
  await popup.getByLabel('表格列数').fill('1');await popup.getByLabel('表格行数').fill('2');await popup.getByRole('button',{name:'应用尺寸'}).click();
  await expect(popup.getByRole('alert')).toContainText('有内容');await expect(table.locator('tr')).toHaveCount(5);
  await popup.getByLabel('表格行数').press('Escape');
  await tools.getByRole('button',{name:'调整表格尺寸',exact:true}).click();await popup.getByLabel('表格列数').fill('2');await popup.getByLabel('表格行数').fill('2');await popup.getByRole('button',{name:'应用尺寸'}).click();
  await expect(table.locator('tr')).toHaveCount(2);await expect(table).toContainText('data');
  await tools.getByRole('button',{name:'调整表格尺寸',exact:true}).click();await page.screenshot({path:'test-results/table-icons.png'});await popup.getByLabel('表格行数').press('Escape');
  await page.getByRole('button',{name:'Markdown',exact:true}).click();await expect(page.locator('.cm-content')).toContainText('keep');await expect(page.locator('.cm-content')).not.toContainText('应用尺寸');
});

test('delete table icon removes only the active table and supports undo',async({page})=>{
 await page.goto('/');
 await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'delete-table.md',mimeType:'text/markdown',buffer:Buffer.from('Before\n\n| A | B |\n| - | - |\n| keep | data |\n\nAfter\n')});
 const editor=page.locator('.ProseMirror');await editor.locator('td').first().click();
 await page.getByRole('toolbar',{name:'表格工具'}).getByRole('button',{name:'删除整个表格',exact:true}).click();
 await expect(editor.locator('table')).toHaveCount(0);await expect(editor).toContainText('Before');await expect(editor).toContainText('After');
 await expect(page.getByRole('toolbar',{name:'表格工具'})).toHaveCount(0);
 await page.keyboard.press('Meta+z');await expect(editor.locator('table')).toHaveCount(1);await expect(editor.locator('table')).toContainText('keep');await expect(editor.locator('table')).toContainText('data');
});
