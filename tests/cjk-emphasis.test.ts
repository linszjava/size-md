// @vitest-environment jsdom
import { it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { cjkEmphasis } from '../src/lib/cjk-emphasis';
import { renderArticle } from '../src/lib/render';

it('parses Chinese punctuation next to bold delimiters and preserves it through save/reopen',()=>{
 const source='**阅读提示：**你可以切换主题。\n\n**检查重点：**缩进和换行。';
 const pipeline=unified().use(remarkParse).use(cjkEmphasis).use(remarkStringify);
 const saved=String(pipeline.processSync(source));
 expect(saved).not.toContain('\\*');
 const root=document.createElement('div');root.innerHTML=renderArticle(saved,'gothic',16).html;
 expect([...root.querySelectorAll('strong')].map(n=>n.textContent)).toEqual(['阅读提示：','检查重点：']);
});
it('preserves deliberately escaped asterisks and code examples',()=>{
 const root=document.createElement('div');root.innerHTML=renderArticle('\\*\\*阅读提示：\\*\\*你\n\n`**代码：**你`\n\n```text\n**代码：**你\n```','gothic',16).html;
 expect(root.querySelector('strong')).toBeNull();
 expect(root.textContent).toContain('**阅读提示：**你');
});
