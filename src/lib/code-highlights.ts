import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import hljs from 'highlight.js/lib/common';

function decorations(doc: ProseNode) {
  const spans: Decoration[] = [];
  doc.descendants((node, pos) => {
    const language = node.attrs.language as string | undefined;
    if (node.type.name !== 'code_block' || !language || !hljs.getLanguage(language)) return;
    const element = document.createElement('div');
    element.innerHTML = hljs.highlight(node.textContent, { language }).value;
    let offset = pos + 1;
    const visit = (child: ChildNode, classes: string) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const length = child.textContent?.length ?? 0;
        if (classes && length) spans.push(Decoration.inline(offset, offset + length, { class: classes }));
        offset += length;
      } else {
        const combined = [classes, (child as HTMLElement).className].filter(Boolean).join(' ');
        child.childNodes.forEach(n => visit(n, combined));
      }
    };
    element.childNodes.forEach(child => visit(child, ''));
  });
  return DecorationSet.create(doc, spans);
}

export const codeHighlights = $prose(() => new Plugin({
  state: {
    init: (_, state) => decorations(state.doc),
    apply: (tr, previous) => tr.docChanged ? decorations(tr.doc) : previous,
  },
  props: { decorations(state) { return this.getState(state); } },
}));
