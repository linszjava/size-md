// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderArticle } from '../src/lib/render';
import { importTyporaTheme } from '../src/lib/themes';

describe('portable WeChat HTML', () => {
  it('inlines theme styles and preserves code spacing and table structure', () => {
    const result = renderArticle('# 标题\n\n**重点**\n\n```js\nconst x = 1;\n  console.log(x);\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |', 'gothic', 18);
    const root = document.createElement('div'); root.innerHTML = result.html;
    expect(root.querySelector('section')?.style.fontSize).toBe('18px');
    expect(root.querySelector('h1')?.getAttribute('style')).toContain('font-size');
    expect(root.querySelector('code')?.textContent).toContain('\n  console.log(x);');
    expect(root.querySelectorAll('td')).toHaveLength(2);
    expect(result.html).not.toContain('class=');
  });
  it('does not export active HTML or executable URL schemes', () => {
    const result = renderArticle('<script>alert(1)</script>\n\n[click](javascript:alert%281%29)\n\n![x](file:///private/test.png)', 'gothic', 16);
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('javascript:');
    expect(result.html).not.toContain('file:///');
    expect(result.hasMissingImages).toBe(true);
  });
  it('preserves public image URLs and rejects temporary embedded images', () => {
    expect(renderArticle('![a](https://img.example.com/a.png)', 'gothic', 16).html).toContain('https://img.example.com/a.png');
    expect(renderArticle('![a](blob:temporary)', 'gothic', 16).hasMissingImages).toBe(true);
  });
  it('adapts scoped theme rules without loading external resources', () => {
    const imported = importTyporaTheme('#write h2 {color:#123456;position:fixed} #write p {line-height:2} .sidebar {color:red}');
    expect(imported.rules.h2.color).toBe('#123456');
    expect(imported.rules.h2.position).toBeUndefined();
    expect(imported.rules.p['line-height']).toBe('2');
    expect(imported.skipped).toBe(2);
  });
});

it('exports safe text/background colors with nested emphasis',()=>{
  const root=document.createElement('div');root.innerHTML=renderArticle('<span style="color:#d44c47"><span style="background-color:#fff2a8">**彩色文字**</span></span>', 'gothic',16).html;
  expect(root.querySelector('span')?.style.color).toBe('rgb(212, 76, 71)');
  expect(root.querySelector('span span')?.style.backgroundColor).toBe('rgb(255, 242, 168)');
  expect(root.querySelector('strong')?.textContent).toBe('彩色文字');
});

it('resolves Typora root variables and rejects unsafe resolved values',()=>{
 const imported=importTyporaTheme(':root{--accent:#b12345;--base:var(--accent);--unsafe:url(https://example.com/a)} #write h2{color:var(--base);border-color:var(--missing,#123456);background:var(--unsafe)}');
 expect(imported.rules.h2.color).toBe('#b12345');expect(imported.rules.h2['border-color']).toBe('#123456');expect(imported.rules.h2['background-color']).toBeUndefined();
});

import { requiresSourceMode } from '../src/lib/source';
it('allows HTML/JSX inside fenced code while guarding raw HTML and diagrams',()=>{
 expect(requiresSourceMode('```tsx\n<section>example</section>\n```')).toBe(false);
 expect(requiresSourceMode('<section>example</section>')).toBe(true);
 expect(requiresSourceMode('```mermaid\ngraph TD\n```')).toBe(true);
});
it('renders themes with packaged fonts without treating font declarations as selectors',()=>{
 const {rules}=importTyporaTheme('@font-face{font-family:Test;src:url(asset://localhost/tmp/test.woff2)} p{font-family:Test}');
 expect(renderArticle('测试正文','gothic',16,rules).html).toContain('font-family: Test');
});
it('adapts Typora code blocks and syntax tokens across theme switches and export',()=>{
 const a=importTyporaTheme('.cm-s-inner.CodeMirror{background:#112233;color:#eeeeee;font-family:TestMono;padding:12px;border-radius:7px} .cm-s-inner .cm-keyword{color:#ff7788} .cm-string{color:#33aa44} pre code{font-size:15px}').rules;
 const b=importTyporaTheme('.md-fences{background:#fafafa;font-family:OtherMono} .cm-keyword{color:#5544aa}').rules;
 const render=(custom:typeof a)=>{const root=document.createElement('div');root.innerHTML=renderArticle('```js\nconst x = "hello";\n```','gothic',16,custom).html;return root;};
 const first=render(a),second=render(b);
 expect(first.querySelector('pre')?.style.backgroundColor).toBe('rgb(17, 34, 51)');
 expect(first.querySelector('pre')?.style.fontFamily).toBe('TestMono');
 expect(first.querySelector('pre code')?.style.fontFamily).toBe('inherit');
 expect(first.querySelector('pre code')?.style.fontSize).toBe('15px');
 expect(first.innerHTML).toContain('rgb(255, 119, 136)');
 expect(second.innerHTML).toContain('rgb(85, 68, 170)');
 expect(second.querySelector('pre')?.style.fontFamily).toBe('OtherMono');
});

it('exports heading bars and quotation decorations without pseudo-elements or absolute positioning',()=>{
 const custom=importTyporaTheme('h3::before{content:"";position:absolute;left:-6px;width:5px;height:61%;background-color:#3498db} h1::after{content:"";position:absolute;height:4px;background:linear-gradient(to right,#85c1e9,#3498db)} blockquote{padding:18px 20px 18px 48px} blockquote::before{content:"✨";position:absolute;left:16px;font-size:20px}').rules;
 const root=document.createElement('div');root.innerHTML=renderArticle('# Title\n\n### Heading\n\n> Quote','gothic',16,custom).html;
 expect(root.querySelector('h3')?.style.borderLeft).toContain('5px solid');
 expect(root.querySelector('h1')?.style.borderBottom).toContain('4px solid');
 expect(root.querySelector('blockquote p span')?.textContent).toBe('✨');
 expect(root.querySelector('blockquote p span')?.style.position).toBe('');
 expect(root.querySelector('blockquote')?.style.paddingLeft).toBe('20px');
});
it('does not export hover decorations and explains nonportable masks and embedded fonts',()=>{
 const result=renderArticle('### Heading','gothic',16,{'h3:hover::before':{content:'"BAD"'},'section::before':{content:'""','mask-image':'url(test)'},'@font-face 1':{'font-family':'Test',src:'url(asset://localhost/font.ttf)'}});
 expect(result.html).not.toContain('BAD');
 expect(result.warnings.some(w=>w.includes('蒙版'))).toBe(true);
 expect(result.warnings.some(w=>w.includes('字体'))).toBe(true);
});

it('exports explicit paragraph alignment after theme rules without accepting other HTML', () => {
  const result = renderArticle('<div align="center">\n\n## **居中标题**\n\n</div>\n\n<div align="right">\n\n右侧段落\n\n</div>', 'gothic', 16);
  const root=document.createElement('div'); root.innerHTML=result.html;
  expect(root.querySelector('h2')?.style.textAlign).toBe('center');
  expect(root.querySelector('p')?.style.textAlign).toBe('right');
  expect(root.querySelector('strong')?.textContent).toBe('居中标题');
  expect(result.warnings).not.toContain('公式、图表或原始 HTML 尚未适配；请核对预览后再发布。');
});
