import type { Root, Parent, RootContent } from 'mdast';

export const alignmentOpen = /^<div align="(left|center|right|justify)">$/;
// Markdown has no paragraph alignment syntax. Use a narrowly supported HTML
// wrapper, keeping its contents as editable Markdown rather than flattening HTML.
export function textAlignment() {
  return (tree: Root) => {
    const htmlValue = (node: RootContent): string | undefined => node.type === 'html' ? node.value.trim() : node.type === 'paragraph' && node.children.length === 1 && node.children[0].type === 'html' ? node.children[0].value.trim() : undefined;
    const visit = (parent: Parent, inherited?: string) => {
      const output: RootContent[] = [];
      for (let i = 0; i < parent.children.length; i++) {
        const node = parent.children[i];
        const html = htmlValue(node);
        const match = html && alignmentOpen.exec(html);
        if (match) {
          let depth = 1, end = i + 1;
          for (; end < parent.children.length; end++) {
            const next = parent.children[end];
            const value = htmlValue(next);
            if (!value) continue;
            if (alignmentOpen.test(value)) depth++;
            if (value === '</div>') { depth--; if (!depth) break; }
          }
          if (!depth) {
            const group = { type: 'root', children: parent.children.slice(i + 1, end) } as Root;
            visit(group, match[1]); output.push(...group.children); i = end; continue;
          }
        }
        if (inherited && (node.type === 'paragraph' || node.type === 'heading')) {
          node.data = { ...node.data, hProperties: { ...node.data?.hProperties, dataTextAlign: inherited } };
        }
        if ('children' in node) visit(node as Parent, inherited);
        output.push(node);
      }
      parent.children = output as typeof parent.children;
    };
    visit(tree);
  };
}

export function withoutAlignmentWrappers(source: string) {
  const tokens = [...source.matchAll(/<div align="(?:left|center|right|justify)">|<\/div>/g)];
  const stack: number[] = [], paired = new Set<number>();
  tokens.forEach((token, index) => {
    if (token[0] !== '</div>') stack.push(index);
    else if (stack.length) { paired.add(stack.pop()!); paired.add(index); }
  });
  let result = source;
  for (let index = tokens.length - 1; index >= 0; index--) {
    if (!paired.has(index)) continue;
    const token = tokens[index]; result = result.slice(0, token.index) + result.slice(token.index! + token[0].length);
  }
  return result;
}

export function alignmentStyle(alignment: string, heading: boolean) {
  const style: Record<string,string> = { 'text-align': alignment };
  if (heading && alignment !== 'justify') Object.assign(style, {
    display: 'table', 'max-width': '100%',
    'margin-left': alignment === 'left' ? '0' : 'auto',
    'margin-right': alignment === 'right' ? '0' : 'auto',
  });
  return style;
}
