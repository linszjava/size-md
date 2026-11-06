import type { Root, Parent, RootContent } from 'mdast';
import type { VFile } from 'vfile';

// CommonMark rejects closing ** after punctuation immediately followed by Han text.
// Accept this common Chinese writing convention, without reinterpreting escaped literals.
export function cjkEmphasis() {
  return (tree: Root, file: VFile) => {
    const source = String(file.value);
    function visit(parent: Parent) {
      parent.children = parent.children.flatMap(node => {
        if (node.type !== 'text') {
          if ('children' in node) visit(node as Parent);
          return [node];
        }
        if (!node.position || source.slice(node.position.start.offset, node.position.end.offset) !== node.value) return [node];
        const parts: RootContent[] = [];
        const pattern = /(?<![\\*])\*\*([^*\n]*[^\s*][\p{P}])\*\*(?=\p{Script=Han})/gu;
        let end = 0;
        for (const match of node.value.matchAll(pattern)) {
          if (!match[1].trim() || /^\s/.test(match[1])) continue;
          parts.push({ type: 'text', value: node.value.slice(end, match.index) });
          parts.push({ type: 'strong', children: [{ type: 'text', value: match[1] }] });
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
