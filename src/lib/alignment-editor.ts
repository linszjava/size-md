import { alignmentStyle } from './text-alignment';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import { paragraphSchema, headingSchema } from '@milkdown/kit/preset/commonmark';
import type { DOMOutputSpec } from '@milkdown/kit/prose/model';

export const alignmentEditor = [paragraphSchema, headingSchema].flatMap<MilkdownPlugin>(schema => schema.extendSchema(previous => ctx => {
  const base = previous(ctx);
  return {
    ...base,
    attrs: { ...base.attrs, textAlign: { default: null } },
    parseDOM: base.parseDOM?.map(rule => ({ ...rule, getAttrs: (dom: HTMLElement) => {
      const attrs = rule.getAttrs ? rule.getAttrs(dom) : rule.attrs;
      if (attrs === false) return false;
      const alignment = dom.style.textAlign;
      return { ...attrs, textAlign: ['left', 'center', 'right', 'justify'].includes(alignment) ? alignment : null };
    } })),
    toDOM: node => {
      const output = base.toDOM!(node) as [string, Record<string, unknown>, ...DOMOutputSpec[]];
      if (node.attrs.textAlign) output[1] = { ...output[1], style: Object.entries(alignmentStyle(node.attrs.textAlign, node.type.name === 'heading')).map(([key,value])=>`${key}:${value}`).join(';'), 'data-text-align': node.attrs.textAlign };
      return output;
    },
    parseMarkdown: { ...base.parseMarkdown, runner: (state, node, type) => {
      state.openNode(type, { ...(node.type === 'heading' ? { level: node.depth } : {}), textAlign: (node.data as { hProperties?: { dataTextAlign?: string } })?.hProperties?.dataTextAlign ?? null });
      if (node.children) state.next(node.children); else if (node.value) state.addText(String(node.value));
      state.closeNode();
    } },
    toMarkdown: { ...base.toMarkdown, runner: (state, node) => {
      if (node.attrs.textAlign) state.addNode('html', undefined, `<div align="${node.attrs.textAlign}">`);
      base.toMarkdown.runner(state, node);
      if (node.attrs.textAlign) state.addNode('html', undefined, '</div>');
    } },
  };
}));
