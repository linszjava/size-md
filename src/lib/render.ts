import { textAlignment, withoutAlignmentWrappers, alignmentStyle } from './text-alignment';
import { applyImageSize } from './image-size';
import { cjkEmphasis } from './cjk-emphasis';
import { exportDecorations } from './export-decorations';
import { textColors, colorPattern, withoutColorSpans } from './text-colors';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import hljs from 'highlight.js/lib/common';
import { themeRules, type ThemeId, type Rules } from './themes';

import { defaultPreferences, type Preferences } from './preferences';
import { inlineExtensions } from './inline-extensions';
import { linkPreference } from './markdown-preferences';

const processor = unified().use(remarkParse).use(remarkGfm).use(cjkEmphasis).use(inlineExtensions, defaultPreferences).use(linkPreference, { autoLink: true }).use(textColors).use(textAlignment).use(remarkRehype).use(rehypeSanitize, { ...defaultSchema, tagNames: [...(defaultSchema.tagNames || []), 'mark'], protocols: {...defaultSchema.protocols, src: [...(defaultSchema.protocols?.src || []), 'file']}, attributes: {...defaultSchema.attributes, '*': [...(defaultSchema.attributes?.['*'] || []), 'dataTextAlign'], span: [...(defaultSchema.attributes?.span || []), 'dataTextColor', 'dataBackgroundColor']} }).use(rehypeStringify);
export function renderArticle(markdown: string, theme: ThemeId, fontSize: number, custom: Rules = {}, preferences: Preferences = defaultPreferences, forPdf = false) {
  const root = document.createElement('section');
  root.innerHTML = String(processor().use(remarkGfm, { singleTilde: !preferences.subscript }).use(inlineExtensions, preferences).use(linkPreference, { autoLink: preferences.autoLink }).processSync(markdown));
  root.querySelectorAll('pre code').forEach(code => {
    const language = Array.from(code.classList).find(c => c.startsWith('language-'))?.slice(9);
    if (preferences.codeHighlight && language && hljs.getLanguage(language)) code.innerHTML = hljs.highlight(code.textContent ?? '', { language }).value;
  });
  const warnings: string[] = [];
  root.querySelectorAll('img').forEach(img => {
    if (!/^https:\/\//i.test(img.getAttribute('src') ?? '') && !(forPdf && (img.getAttribute('src') || '').startsWith('file://'))) {
      warnings.push('存在未上传或非 HTTPS 图片；请替换成长期外链后再复制公众号排版。');
      const label = document.createElement('p');
      label.textContent = `[图片待上传：${img.alt || '未命名'}]`;
      label.dataset.missingImage = 'true';
      img.replaceWith(label);
    }
  });
  if (root.querySelector('table')) warnings.push('表格请在公众号手机预览中检查宽度。');
  if (root.querySelector('a')) warnings.push('外链是否可点击取决于公众号平台权限。');
  if (/```\s*(mermaid|math)|\$\$|^\s*</m.test(withoutColorSpans(withoutAlignmentWrappers(markdown)))) warnings.push('公式、图表或原始 HTML 尚未适配；请核对预览后再发布。');
  const rules = themeRules(theme, fontSize, custom);
  for (const [selector, values] of Object.entries(rules)) {
    if(selector.startsWith('@') || selector.includes('::'))continue;
    const nodes = selector === 'section' ? [root] : Array.from(root.querySelectorAll<HTMLElement>(selector));
    for (const node of nodes) for (const [prop, value] of Object.entries(values)) node.style.setProperty(prop, value);
  }
  // A solid underlay keeps white heading text readable if the destination drops gradients.
  [root, ...root.querySelectorAll<HTMLElement>('[style]')].forEach(node => {
    if (node.style.backgroundImage.includes('gradient(') && !node.style.backgroundColor) {
      const color = node.style.backgroundImage.match(/#[\da-f]{3,8}\b|rgba?\([^)]+\)/i)?.[0];
      if (color) node.style.backgroundColor = color;
    }
  });
  root.querySelectorAll<HTMLElement>('[data-text-align]').forEach(node => { Object.entries(alignmentStyle(node.dataset.textAlign!, /^H[1-6]$/.test(node.tagName))).forEach(([key,value])=>node.style.setProperty(key,value)); node.removeAttribute('data-text-align'); });
  root.querySelectorAll('img').forEach(applyImageSize);
  warnings.push(...exportDecorations(root, rules));
  root.querySelectorAll<HTMLElement>('mark').forEach(node => { node.style.backgroundColor = '#fff2a8'; node.style.color = 'inherit'; });
  root.querySelectorAll<HTMLElement>('span[data-text-color],span[data-background-color]').forEach(node=>{for(const [key,prop] of [['data-text-color','color'],['data-background-color','background-color']]){const value=node.getAttribute(key);if(value&&colorPattern.test(value))node.style.setProperty(prop,value);node.removeAttribute(key);}});
  root.querySelectorAll('input[type="checkbox"]').forEach(input => {
    const span = document.createElement('span');
    span.textContent = input.hasAttribute('checked') ? '☑ ' : '☐ ';
    input.replaceWith(span);
  });
  root.querySelectorAll('[class]').forEach(node => node.removeAttribute('class'));
  return { html: root.outerHTML, warnings: [...new Set(warnings)], hasMissingImages: !!root.querySelector('[data-missing-image]') };
}
