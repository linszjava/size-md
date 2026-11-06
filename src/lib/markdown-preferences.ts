import type { Root, RootContent, Parent } from 'mdast';
import type { VFile } from 'vfile';

// GFM's literal links are optional, while explicit Markdown links remain intact.
export function linkPreference(options: { autoLink: boolean }) {
  return (tree: Root, file: VFile) => {
    if (options.autoLink) return;
    const source = String(file.value);
    function visit(parent: Parent) {
      parent.children = parent.children.flatMap(node => {
        if (node.type === 'link') {
          const raw = source.slice(node.position?.start.offset, node.position?.end.offset);
          if (!raw.startsWith('[') && !raw.startsWith('<')) return node.children as RootContent[];
        }
        if ('children' in node) visit(node as Parent);
        return [node];
      }) as typeof parent.children;
    }
    visit(tree);
  };
}
