import { parse, generate } from 'css-tree';
import gothicCss from '../themes/gothic.css?raw';
import githubCss from '../themes/github.css?raw';
import newsprintCss from '../themes/newsprint.css?raw';

export type ThemeId = 'gothic' | 'github' | 'newsprint';
export type Rules = Record<string, Record<string, string>>;
export const themes: { id: ThemeId; name: string }[] = [{ id: 'gothic', name: 'Gothic' }, { id: 'github', name: 'GitHub' }, { id: 'newsprint', name: 'Newsprint' }];
const themeSources = { gothic: gothicCss, github: githubCss, newsprint: newsprintCss };
const selectors = new Set(['section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'em', 'a', 'blockquote', 'blockquote p', 'blockquote p:last-child', 'ul', 'ol', 'li', 'li p', 'li ul', 'li ol', 'code', 'pre', 'pre code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'del', 'table th', 'table td', 'table thead th', 'table tr:nth-child(2n)']);

// Typora uses CodeMirror token classes; our editor and exports use highlight.js.
const codeTokens:Record<string,string[]>={
 keyword:['keyword'],string:['string','regexp'],number:['number'],comment:['comment'],
 def:['title'],variable:['variable'], 'variable-2':['variable','params'], 'variable-3':['type'],
 tag:['tag','name','selector-tag'],attribute:['attr','attribute'],property:['property','attribute'],
 atom:['literal','symbol'],builtin:['built_in'],operator:['operator'],meta:['meta'],type:['type'],
 link:['link'],qualifier:['selector-class'], bracket:['punctuation']
};
function adaptCodeSelector(raw:string):string[]{
 const selector=raw.trim().replace(/\.md-heading\b/g,'').replace(/\.md-focus\b/g,':focus-within').replace(/^#write\s+/, '').replace(/\s*>\s*/g,' ');
 if(['.md-fences','.CodeMirror','.cm-s-inner','.cm-s-inner.CodeMirror','.md-fences .cm-s-inner.CodeMirror','.md-fences .CodeMirror'].includes(selector))return ['pre'];
 if(selector==='code:not(.md-fencescode)')return [':not(pre) > code'];
 const token=selector.match(/^(?:(?:\.md-fences|\.CodeMirror|\.cm-s-[\w-]+)\s+)*(?:span)?\.cm-([\w-]+)$/)?.[1]
   ??selector.match(/^\.cm-s-inner\.cm-([\w-]+)$/)?.[1];
 if(token&&codeTokens[token])return codeTokens[token].map(t=>`.hljs-${t}`);
 return [selector];
}

function safeImageValue(prop:string,value:string):boolean {
  if (!['background-image','mask-image','-webkit-mask-image'].includes(prop)) return false;
  return /^url\(["']?(?:asset:\/\/localhost[^)]+|data:image\/svg\+xml,[^)]*|data:image\/png;base64,[a-zA-Z0-9+/=]+)["']?\)$/.test(value);
}

export function importTyporaTheme(css: string, remSize = 16): { rules: Rules; skipped: number } {
  const ast = parse(css);
  const allowedProps = /^(color|background-color|background-image|font-family|font-size|font-weight|font-style|line-height|letter-spacing|text-align|text-transform|text-decoration|vertical-align|margin(-top|-bottom|-left|-right)?|padding(-top|-bottom|-left|-right)?|border(-color|-style|-width|-left|-right|-top|-bottom)?|border-radius|box-shadow|display|width|min-width|max-width|height|min-height|max-height|position|top|left|right|bottom|z-index|opacity|pointer-events|content|transform|background-size|background-position|background-repeat|word-spacing|word-break|word-wrap|(?:-webkit-)?mask-(?:image|size|repeat|position))$/;
  const rules: Rules = {};
  let skipped = 0;
  if (ast.type !== 'StyleSheet') return { rules, skipped: 1 };
  const variables: Record<string,string> = {};
  for(const entry of ast.children){
    if(entry.type!=='Rule'||!generate(entry.prelude).split(',').some(selector=>[':root','body','html','#write'].includes(selector.trim())))continue;
    for(const declaration of entry.block.children)if(declaration.type==='Declaration'&&declaration.property.startsWith('--'))variables[declaration.property]=generate(declaration.value);
  }
  const resolve=(value:string)=>{for(let i=0;i<12&&value.includes('var(');i++){const next=value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g,(all,key,fallback)=>variables[key]??fallback??all);if(next===value)break;value=next;}return value;};
  for (const entry of ast.children) {
    if(entry.type==='Atrule'&&entry.name==='font-face'&&entry.block){
      const face:Record<string,string>={};
      for(const d of entry.block.children)if(d.type==='Declaration'&&['font-family','src','font-weight','font-style','font-display'].includes(d.property)){
        const v=generate(d.value);if(d.property!=='src'||/^url\(["']?asset:\/\/localhost[^)]+\)(?:\s*format\([^)]*\))?$/.test(v))face[d.property]=v;
      }
      if(face.src&&face['font-family'])rules[`@font-face ${Object.keys(rules).length}`]=face;
      continue;
    }
    if (entry.type !== 'Rule') { skipped++; continue; }
    for (let selector of generate(entry.prelude).split(',').flatMap(adaptCodeSelector)) {
      selector = selector.trim();
      if (['#write', 'body', 'html', ':root'].includes(selector)) selector = 'section';
      selector = selector.replace(/^#write(?=::?)/, 'section').replace(/::?(before|after)$/, '::$1');
      if (selector === '.md-fences') selector = 'pre';
      if (!selectors.has(selector)&&!/^(?:section|h[1-6]|blockquote|em|strong)(?::(?:hover|focus|focus-within))?(?:::(?:before|after))$/.test(selector)&&!/^h[1-6] (?:strong|em)$/.test(selector)&&selector!==':not(pre) > code'&&!/^(?:pre |pre code )?(?:\.hljs-[\w-]+)(?:\.[\w-]+)*$/.test(selector)) { skipped++; continue; }
      const declarations: Record<string, string> = {};
      for (const declaration of entry.block.children) {
        if (declaration.type !== 'Declaration') { skipped++; continue; }
        let prop = declaration.property;
        if(prop.startsWith('--'))continue;
        let value = resolve(generate(declaration.value)).trim();
        value = value.replace(/url\("(data:image\/svg\+xml[^"]*)"\)/g, (all, url) => { try { const svg = decodeURIComponent(url.slice(url.indexOf(',')+1)); if (/<\/?(?!svg\b|path\b|circle\b|rect\b|line\b|polyline\b|polygon\b|ellipse\b|g\b)[a-z]|\bon\w+\s*=|href\s*=/i.test(svg)) return 'none'; return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`; } catch { return 'none'; } });
        if(prop==='background' && /^(linear-gradient\(|url\()/i.test(value))prop='background-image';
        if (prop === 'background' && /^(#[\da-f]{3,8}|white|black|transparent)$/i.test(value)) prop = 'background-color';
        if ((prop==='position' && !(['relative','static'].includes(value) || (value==='absolute' && selector.includes('::')))) || !allowedProps.test(prop) || /var\(|expression|[<>]/i.test(value) || (value.includes('url(')&&!safeImageValue(prop,value))) { skipped++; continue; }
        value = value.replace(/(-?[\d.]+)rem\b/g, (_, n) => `${Number(n) * remSize}px`);
        declarations[prop] = value;
      }
      if(Object.keys(declarations).length) rules[selector] = { ...rules[selector], ...declarations };
    }
  }
  return { rules, skipped };
}

const themeCache = new Map<string, Rules>();
export function themeRules(id: ThemeId, fontSize = 16, custom: Rules = {}): Rules {
  const rules: Rules = {
    section: { 'font-family': '"Helvetica Neue","PingFang SC",sans-serif', 'font-size': `${fontSize}px`, 'font-synthesis': 'weight style', color: '#333', 'background-color': '#fff', 'line-height': '1.75', 'overflow-wrap': 'break-word', 'text-align': 'left' },
    h1: { 'font-size': '36px', 'font-weight': '400', 'line-height': '1.4' },
    h2: { 'font-size': '28px', 'font-weight': '400', 'line-height': '1.4' },
    h3: { 'font-size': '24px', margin: '24px 0 16px', 'line-height': '1.4' },
    h4: { 'font-size': '20px', margin: '20px 0 12px' },
    h5: { 'font-size': '18px', margin: '18px 0 12px' },
    h6: { 'font-size': '16px', margin: '16px 0 12px' },
    p: { margin: '0 0 20px', 'font-size': `${fontSize}px` },
    strong: { 'font-weight': '700', color: 'inherit' },
    em: { 'font-style': 'italic' },
    a: { color: '#990000', 'text-decoration': 'none' },
    blockquote: { 'border-left': '1px solid gray', color: '#6f6f6f' },
    ul: { 'padding-left': '32px', margin: '0 0 20px' },
    ol: { 'padding-left': '32px', margin: '0 0 20px' },
    li: { margin: '5px 0' }, 'li p': { margin: '0' },
    code: { 'font-family': 'Menlo,Consolas,monospace' },
    pre: { 'font-family': 'Menlo,Consolas,monospace', 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere', 'line-height': '1.6', 'background-color': '#fcfcfc' },
    'pre code': { 'font-family': 'inherit', 'font-size': 'inherit', 'line-height':'inherit', border: '0', padding: '0', margin: '0', color: 'inherit', 'background-color':'transparent', 'white-space': 'pre-wrap' },
    table: { width: '100%', 'border-collapse': 'collapse', 'font-size': '14px' },
    th: { 'text-align': 'left' }, td: { 'text-align': 'left' },
    img: { 'max-width': '100%', height: 'auto', display: 'block', margin: '20px auto' },
    hr: { border: '0', 'border-top': '1px solid #ddd', margin: '30px 0' },
    del: { 'text-decoration': 'line-through' },
    '.hljs-keyword': { color: '#708' }, '.hljs-string': { color: '#a11' },
    '.hljs-number': { color: '#164' }, '.hljs-comment': { color: '#a50' },
    '.hljs-title': { color: '#00f' }, '.hljs-built_in': { color: '#30a' },
  };
  for (let level=1;level<=6;level++) rules[`h${level} strong`] = { color:'inherit', 'font-family':'inherit' };
  const cacheKey = `${id}:${fontSize}`;
  if (!themeCache.has(cacheKey)) themeCache.set(cacheKey, importTyporaTheme(themeSources[id] ?? gothicCss, fontSize).rules);
  for (const source of [Object.keys(custom).length ? {} : themeCache.get(cacheKey)!, custom]) {
    for (const [selector, values] of Object.entries(source)) rules[selector] = { ...rules[selector], ...values };
  }
  rules.section['font-size'] = `${fontSize}px`;
  if (!custom.p?.['font-size']) rules.p['font-size'] = `${fontSize}px`;

  return rules;
}

export function rulesCss(rules: Rules, includeFontFaces = true) {
  return Object.entries(rules).map(([selector, styles]) => {
    if(selector.startsWith('@font-face'))return !includeFontFaces ? '' : `@font-face{${Object.entries(styles).map(([k,v])=>`${k}:${v}`).join(';')}}`;
    const target = selector.startsWith('section') ? selector.replace(/^section/, '.article-content') : `.article-content ${selector}`;
    return `${target}{${Object.entries(styles).map(([k, v]) => `${k}:${v}`).join(';')}}`;
  }).join('\n');
}
