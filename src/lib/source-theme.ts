import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const sourceExtensions = [
  EditorView.lineWrapping,
  EditorView.theme({
    '&': { color: '#41454b', backgroundColor: '#fff', fontSize: '14px' },
    '.cm-scroller': { fontFamily: '"SFMono-Regular", Menlo, "PingFang SC", monospace', lineHeight: '1.9' },
    '.cm-content': { padding: '28px 0 100px', caretColor: '#444' },
    '.cm-line': { padding: '0 24px 0 18px' },
    '.cm-gutters': { backgroundColor: '#fff', color: '#b9bcc1', border: 'none', paddingLeft: '12px' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 4px', minWidth: '40px', fontSize: '12px' },
    '.cm-activeLine': { backgroundColor: '#f7f8fa' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#747b85' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#e4e9ef !important' },
    '&.cm-focused': { outline: 'none' },
  }),
  syntaxHighlighting(HighlightStyle.define([
    { tag: tags.heading, color: '#373d45', fontWeight: '600', textDecoration: 'none' },
    { tag: tags.strong, fontWeight: '600', color: '#454b54' },
    { tag: tags.emphasis, fontStyle: 'italic', color: '#626973' },
    { tag: [tags.link, tags.url], color: '#687f96', textDecoration: 'none' },
    { tag: [tags.processingInstruction, tags.meta, tags.punctuation], color: '#9299a2' },
    { tag: [tags.monospace, tags.string], color: '#7b7067' },
    { tag: [tags.keyword, tags.atom, tags.number, tags.bool], color: '#77758b' },
    { tag: [tags.comment, tags.quote], color: '#90959d' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
  ])),
];
