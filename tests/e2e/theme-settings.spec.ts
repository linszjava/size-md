import {test,expect} from '@playwright/test';
test('theme settings import CSS variables, apply and retain theme after restart',async({page})=>{
 await page.goto('/');const settings=async()=>{await page.locator('.web-settings:not(.web-files):not(.web-editing) summary').click();await page.getByRole('button',{name:'应用设置…'}).click();await page.getByRole('button',{name:'主题',exact:true}).click();};await settings();await page.getByRole('textbox',{name:'主题文件目录'}).fill('/tmp/size-md-themes');await page.getByRole('button',{name:'保存目录',exact:true}).click();
 await page.locator('input[accept=".css"]').setInputFiles({name:'variable-test.css',mimeType:'text/css',buffer:Buffer.from(':root{--accent:#b12345} #write h2{color:var(--accent)}')});await expect(page.getByRole('combobox',{name:'当前文章主题'})).toContainText('variable-test.css');await page.getByRole('button',{name:'关闭设置',exact:true}).click();await expect(page.locator('.ProseMirror h2').first()).toHaveCSS('color','rgb(177, 35, 69)');await expect(page.getByText('草稿已保存')).toBeVisible();await page.reload();await expect(page.locator('.ProseMirror h2').first()).toHaveCSS('color','rgb(177, 35, 69)');await settings();await expect(page.getByRole('textbox',{name:'主题文件目录'})).toHaveValue('/tmp/size-md-themes');await page.getByRole('combobox',{name:'当前文章主题'}).click();await page.getByRole('option',{name:'GitHub',exact:true}).click();await page.getByRole('button',{name:'关闭设置',exact:true}).click();await expect(page.locator('.ProseMirror h2').first()).not.toHaveCSS('color','rgb(177, 35, 69)');
});
test('new articles inherit imported theme rules and name',async({page})=>{
 await page.goto('/');await page.locator('input[accept=".css"]').setInputFiles({name:'inherit-test.css',mimeType:'text/css',buffer:Buffer.from('#write h1{color:#b12345}')});
 await expect(page.locator('.ProseMirror h1').first()).toHaveCSS('color','rgb(177, 35, 69)');
 await page.locator('.web-files summary').click();await page.getByRole('button',{name:'新建文章',exact:true}).click();
 await expect(page.locator('.ProseMirror h1')).toHaveCSS('color','rgb(177, 35, 69)');await expect(page.getByText('草稿已保存')).toBeVisible();
 const drafts=await page.evaluate(()=>JSON.parse(localStorage.getItem('size-md-drafts-v1')!));
 expect(drafts[0].themeName).toBe('inherit-test.css');expect(drafts[0].custom).toEqual(drafts[1].custom);expect(drafts[0].fontSize).toBe(drafts[1].fontSize);
});
