import { alignmentEditor } from '../lib/alignment-editor';
import { textAlignment } from '../lib/text-alignment';
import { sourceSelection, editorSelection, type SelectionOffsets } from '../lib/source-selection';
import ImageTools from './ImageTools';
import { cjkEmphasis } from '../lib/cjk-emphasis';
import { colorEditor } from '../lib/color-editor';
import { textColors } from '../lib/text-colors';
import SelectionToolbar from './SelectionToolbar';
import { slashMenu } from '../lib/slash-menu';
import TableTools from './TableTools';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useRef, useEffect, useState } from 'react';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, serializerCtx, editorViewCtx, commandsCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm, remarkGFMPlugin, insertTableCommand } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { upload, uploadConfig } from '@milkdown/kit/plugin/upload';
import { insert, $prose, $remark } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration } from '@milkdown/kit/prose/view';
import { editorActions, editorFlags, type EditorActions, type MenuFlags } from '../lib/editor-actions';
import { inputRules, emDash, ellipsis, smartQuotes } from '@milkdown/kit/prose/inputrules';
import type { Preferences } from '../lib/preferences';
import { inlineExtensions } from '../lib/inline-extensions';
import { inlineEditor } from '../lib/inline-editor';
import { linkPreference } from '../lib/markdown-preferences';
import { localImageView } from '../lib/local-image-view';
import { tableNavigation } from '../lib/table-navigation';
import { codeHighlights } from '../lib/code-highlights';
import '@milkdown/kit/prose/view/style/prosemirror.css';
import '@milkdown/kit/prose/tables/style/tables.css';

type Props = { takeSelection: () => SelectionOffsets | null; onSourceSelection: (get: ((source: string) => { anchor: number; head: number }) | null) => void; onCommand: (id:string)=>void; preferences: Preferences; typewriter: boolean; onActions: (actions: EditorActions | null) => void; onFlags: (flags: MenuFlags) => void; initial: string; onChange: (value: string) => void; onUpload: (file: File) => Promise<string | null>; onReady: (insertText: ((text: string) => void) | null) => void };
function EditorBody(props: Props) {
  const [tableView,setTableView]=useState<EditorView|null>(null);
  const latest = useRef(props); latest.current = props;
  const { get, loading } = useEditor(root => Editor.make()
    .config(ctx => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, props.initial);
      ctx.set(remarkGFMPlugin.options.key, { singleTilde: !props.preferences.subscript });
      ctx.update(remarkStringifyOptionsCtx, prev => ({ ...prev, setext: props.preferences.headingStyle === 'setext', bullet: props.preferences.bullet, incrementListMarker: props.preferences.orderedStyle === 'increment' }));
      ctx.update(editorViewOptionsCtx, prev => ({ ...prev, attributes: { class: 'article-content', 'aria-label': '文章编辑器', spellcheck: String(props.preferences.spellcheck) } }));
      ctx.update(uploadConfig.key, prev => ({
        ...prev,
        enableHtmlFileUploader: true,
        uploadWidgetFactory: (pos, spec) => {
          const span = document.createElement('span'); span.className = 'upload-placeholder'; span.textContent = '图片上传中…';
          return Decoration.widget(pos, span, spec);
        },
        uploader: async (files, schema) => {
          const nodes = [];
          for (const file of Array.from(files)) {
            const url = await latest.current.onUpload(file);
            if (url) nodes.push(schema.nodes.image.create({ src: url, alt: file.name }));
          }
          return nodes;
        },
      }));
    }).use(slashMenu(id=>latest.current.onCommand(id))).use(tableNavigation).use(commonmark).use(gfm).use(alignmentEditor).use($remark('textAlignment', () => textAlignment)).use(history).use(upload).use(clipboard).use(codeHighlights).use(localImageView)
    .use($remark('cjkEmphasis', () => cjkEmphasis))
    .use(colorEditor).use($remark('textColors', () => textColors))
    .use(inlineEditor(props.preferences))
    .use($remark('inlineExtensions', () => inlineExtensions, props.preferences))
    .use($remark('linkPreference', () => linkPreference, { autoLink: props.preferences.autoLink }))
    .use($prose(() => inputRules({ rules: [...(props.preferences.smartPunctuation ? [emDash, ellipsis] : []), ...(props.preferences.smartQuotes ? smartQuotes : [])] })))
    .use($prose(ctx => new Plugin({ view: () => ({ update: (view, prev) => {
      if (!view.state.selection.eq(prev.selection) || !view.state.doc.eq(prev.doc)) view.dom.dispatchEvent(new Event("table-change"));
      if (!view.state.selection.eq(prev.selection) || !view.state.doc.eq(prev.doc) || view.state.storedMarks !== prev.storedMarks) latest.current.onFlags(editorFlags(view));
      if (latest.current.typewriter && (!view.state.selection.eq(prev.selection) || !view.state.doc.eq(prev.doc))) requestAnimationFrame(() => { if (view.isDestroyed) return; const pane = view.dom.closest('.editor-pane'); if (pane) { const caret = view.coordsAtPos(view.state.selection.head); pane.scrollTop += caret.top - pane.getBoundingClientRect().top - pane.clientHeight / 2; } });
      if (!view.state.doc.eq(prev.doc)) latest.current.onChange(ctx.get(serializerCtx)(view.state.doc));
    } }) }))), []);
  useEffect(() => {
    if (!loading) { props.onReady(text => get()?.action(insert(text))); get()?.action(ctx => { const view = ctx.get(editorViewCtx); setTableView(view);
      const pending = latest.current.takeSelection();
      if (pending) {
        const selection = editorSelection(view.state.doc, ctx.get(serializerCtx), latest.current.initial, pending);
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selection.anchor, selection.head)).scrollIntoView());
        view.focus();
        requestAnimationFrame(() => {
          if (view.isDestroyed) return;
          const pane = view.dom.closest('.editor-pane');
          if (pane) {
            const caret = view.coordsAtPos(selection.head);
            pane.scrollTo({ top: pane.scrollTop + caret.top - pane.getBoundingClientRect().top - pane.clientHeight / 2, behavior: 'instant' });
          }
        });
      } latest.current.onSourceSelection(source => sourceSelection(view.state.doc, ctx.get(serializerCtx), source, view.state.selection.anchor, view.state.selection.head)); latest.current.onActions(editorActions(view, (row, col) => ctx.get(commandsCtx).call(insertTableCommand.key, {row,col}))); latest.current.onFlags(editorFlags(view)); }); }
    return () => { props.onReady(null); latest.current.onSourceSelection(null); latest.current.onActions(null); };
  }, [loading, get]);
  return <><Milkdown />{tableView&&<><TableTools view={tableView}/><ImageTools view={tableView}/></>}{tableView&&props.preferences.selectionToolbar&&<SelectionToolbar view={tableView} onCommand={props.onCommand}/>}</>;
}
export default function Writer(props: Props) { return <MilkdownProvider><EditorBody {...props}/></MilkdownProvider>; }
