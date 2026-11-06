import {test,expect} from '@playwright/test';
test('article toolbar preserves selection, applies blocks and remembers closing',async({page})=>{
 await page.goto('/');await page.locator('input[accept=".md,.markdown,.txt"]').setInputFiles({name:'toolbar.md',mimeType:'text/markdown',buffer:Buffer.from('工具栏文字\n')});
 const bar=page.getByRole('toolbar',{name:'文章工具栏',exact:true});await expect(bar).toBeVisible();
 await page.locator('.ProseMirror').click();await page.keyboard.press('Home');await page.keyboard.press('Shift+End');
 await bar.getByRole('button',{name:'加粗',exact:true}).click();await expect(page.locator('.ProseMirror strong')).toHaveText('工具栏文字');
 await bar.getByRole('button',{name:'段落样式',exact:true}).click();await bar.getByRole('menuitemradio',{name:'二级标题'}).click();await expect(page.locator('.ProseMirror h2')).toHaveText('工具栏文字');
 await bar.getByRole('button',{name:'段落样式',exact:true}).click();await bar.getByRole('menuitemradio',{name:'正文'}).click();await bar.getByRole('button',{name:'引用',exact:true}).click();await expect(page.locator('.ProseMirror blockquote')).toHaveText('工具栏文字');
 await page.screenshot({path:'test-results/article-toolbar.png'});
 await page.getByRole('button',{name:'Markdown',exact:true}).click();await expect(bar).toHaveCount(0);await page.getByRole('button',{name:'即时编辑',exact:true}).click();await expect(bar).toBeVisible();
 await bar.getByRole('button',{name:'关闭文章工具栏',exact:true}).click();await expect(bar).toHaveCount(0);await page.reload();await expect(bar).toHaveCount(0);
 await page.locator('.web-settings:not(.web-files):not(.web-editing) summary').click();await page.getByRole('button',{name:'应用设置…'}).click();await page.getByRole('button',{name:'编辑器',exact:true}).click();await page.getByRole('checkbox',{name:/显示文章顶部工具栏/}).check();await page.getByRole('button',{name:'关闭设置'}).click();await expect(bar).toBeVisible();
});
