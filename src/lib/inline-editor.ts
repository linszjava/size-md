import { $markSchema, $inputRule } from '@milkdown/kit/utils';
import { markRule } from '@milkdown/kit/prose';
import type { Preferences } from './preferences';
import { inlineKinds } from './inline-extensions';
export function inlineEditor(preferences: Preferences) {
  return inlineKinds.filter(kind => preferences[kind.key]).flatMap(kind => {
    const schema = $markSchema(kind.key, () => ({
      excludes: '_',
      parseDOM: [{ tag: kind.tag }], toDOM: () => [kind.tag, 0],
      parseMarkdown: { match: node => node.type === kind.key, runner: (state, node, type) => { state.openMark(type); state.next(node.children); state.closeMark(type); } },
      toMarkdown: { match: mark => mark.type.name === kind.key, runner: (state, mark) => { state.withMark(mark, kind.key); } },
    }));
    const regex = kind.key === 'subscript' ? /(?<![~\\])~([^~\s]+)~$/ : kind.key === 'superscript' ? /(?<![\^\\])\^([^\^\s]+)\^$/ : /(?<![=\\])==([^=\n]+)==$/;
    return [...schema, $inputRule(ctx => markRule(regex, schema.type(ctx)))];
  });
}
