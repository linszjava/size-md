import {test,expect} from '@playwright/test';
test('code block appearance and highlighting follow imported themes',async({page})=>{
 await page.goto('/');
 const input=page.locator('input[accept=".css"]');
 await input.setInputFiles({name:'code-dark.css',mimeType:'text/css',buffer:Buffer.from('.cm-s-inner.CodeMirror{background:#112233;font-family:TestMono} .cm-keyword{color:#ff7788} pre code{font-size:15px}')});
 const pre=page.locator('.ProseMirror pre').first();
 await expect(pre).toHaveCSS('background-color','rgb(17, 34, 51)');
 await expect(pre.locator('code')).toHaveCSS('font-family','TestMono');
 await expect(pre.locator('.hljs-keyword').first()).toHaveCSS('color','rgb(255, 119, 136)');
 await input.setInputFiles({name:'code-light.css',mimeType:'text/css',buffer:Buffer.from('.md-fences{background:#fafafa;font-family:OtherMono} .cm-keyword{color:#5544aa}')});
 await expect(pre).toHaveCSS('background-color','rgb(250, 250, 250)');
 await expect(pre.locator('code')).toHaveCSS('font-family','OtherMono');
 await expect(pre.locator('.hljs-keyword').first()).toHaveCSS('color','rgb(85, 68, 170)');
});
