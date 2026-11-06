import type { Rules } from './themes';

// Clipboard HTML has no stylesheet: express static pseudo-elements in normal flow.
export function exportDecorations(root: HTMLElement, rules: Rules): string[] {
  const warnings = new Set<string>();
  for (const [selector, values] of Object.entries(rules)) {
    const match = selector.match(/^(section|h[1-6]|blockquote|em|strong)::(before|after)$/);
    if (!match) continue;
    const [, tag, side] = match;
    const masked = Object.keys(values).some(key => key.includes('mask-'));
    if (tag === 'section' || masked) {
      warnings.add('主题的蒙版背景或图标无法直接随剪贴板携带，公众号预览已省略这类装饰。');
      continue;
    }
    const content = values.content?.match(/^(["'])([\s\S]*)\1$/)?.[2];
    if (content === undefined) continue;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(tag));
    for (const node of nodes) {
      const color = values['background-color'];
      // Absolute heading bars become borders; no positioning support required.
      if (!content && /^h[1-6]$/.test(tag) && values.position === 'absolute') {
        const edge = side === 'before' ? 'left' : 'bottom';
        const gradientColor = values['background-image']?.match(/#[\da-f]{3,8}\b/i)?.[0];
        if (!color && !gradientColor) continue;
        node.style.setProperty(`border-${edge}`, `${values[edge === 'left' ? 'width' : 'height'] || '3px'} solid ${color || gradientColor}`);
        node.style.setProperty(`padding-${edge}`, edge === 'left' ? '12px' : '8px');
        continue;
      }
      const span = document.createElement('span');
      span.textContent = content || '\u00a0';
      for (const [key, value] of Object.entries(values)) {
        if (['content','position','top','bottom','left','right','transform','z-index','pointer-events'].includes(key)) continue;
        span.style.setProperty(key, value);
      }
      span.style.display = 'inline-block';
      if (!span.style.marginRight && side === 'before') span.style.marginRight = '8px';
      if (tag === 'blockquote' && content) {
        const paragraph = node.querySelector('p');
        (paragraph || node).prepend(span);
        node.style.paddingLeft = node.style.paddingRight || '20px';
      } else if (side === 'before') node.prepend(span);
      else node.append(span);
    }
  }
  if (Object.keys(rules).some(key => key.startsWith('@font-face'))) {
    warnings.add('主题内嵌字体不会随复制内容上传到公众号；未安装该字体的设备会使用备用字体。');
  }
  return [...warnings];
}
