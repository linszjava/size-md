import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Nodes } from 'mdast';
const parser = unified().use(remarkParse);
function text(node: Nodes): string {
  if ('value' in node) return node.value;
  if ('children' in node) return node.children.map(text).join('');
  return '';
}
export function documentHeadings(markdown: string) {
  return parser.parse(markdown).children.filter(node => node.type === 'heading' && node.depth <= 3).map(node => ({ level: node.type === 'heading' ? node.depth : 1, text: text(node) }));
}
