import type { Root, Parent, RootContent } from 'mdast';
import type { VFile } from 'vfile';
import type { Processor } from 'unified';
import type { Preferences } from './preferences';

export const inlineKinds = [
  { key: 'subscript', marker: '~', tag: 'sub' },
  { key: 'superscript', marker: '^', tag: 'sup' },
  { key: 'highlight', marker: '==', tag: 'mark' },
] as const;

// Inline extensions deliberately support plain text contents; nested formatting remains source text.
export function inlineExtensions(this: Processor, options: Preferences) {
  const data = this.data();
  const extensions = (data.toMarkdownExtensions || []) as object[];
  data.toMarkdownExtensions = [...extensions, { handlers: Object.fromEntries(inlineKinds.map(kind => [kind.key, (node: Parent) => {
    const text = node.children.map(child => 'value' in child ? child.value : '').join('');
    return `${kind.marker}${text.replace(/\\/g, '\\\\').replace(/[~^=]/g, '\\$&')}${kind.marker}`;
  }])) }];
  return (tree: Root, file: VFile) => {
    const source = String(file.value);
    function visit(parent: Parent) {
      parent.children = parent.children.flatMap(node => {
        if (node.type !== 'text') {
          if ('children' in node && node.type !== 'link' && node.type !== 'linkReference' && node.type !== 'strong' && node.type !== 'emphasis' && node.type !== 'delete') visit(node as Parent);
          return [node];
        }
        // Do not reinterpret escaped markers, HTML entities, or parser-normalized text.
        if (node.position && source.slice(node.position.start.offset, node.position.end.offset) !== node.value) return [node];
        const parts: RootContent[] = [];
        const pattern = /(?<![~\\])~([^~\s]+)~(?!~)|(?<![\^\\])\^([^\^\s]+)\^(?!\^)|(?<![=\\])==([^=\n]+)==(?![=])/g;
        let end = 0;
        for (const match of node.value.matchAll(pattern)) {
          const kind = inlineKinds[match[1] ? 0 : match[2] ? 1 : 2];
          if (!options[kind.key]) continue;
          parts.push({ type: 'text', value: node.value.slice(end, match.index) });
          parts.push({ type: kind.key, children: [{ type: 'text', value: match[1] || match[2] || match[3] }], data: { hName: kind.tag } } as unknown as RootContent);
          end = match.index! + match[0].length;
        }
        if (!end) return [node];
        parts.push({ type: 'text', value: node.value.slice(end) });
        return parts;
      }) as typeof parent.children;
    }
    visit(tree);
  };
}
