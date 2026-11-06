import type { EditorView } from '@milkdown/kit/prose/view';
import { TextSelection } from '@milkdown/kit/prose/state';
import { setBlockType, toggleMark, wrapIn, lift } from '@milkdown/kit/prose/commands';
import { wrapInList, sinkListItem, liftListItem } from '@milkdown/kit/prose/schema-list';
import { undo, redo } from '@milkdown/kit/prose/history';
import { addRowBefore, addRowAfter, addColumnBefore, addColumnAfter, deleteRow, deleteColumn, deleteTable, TableMap, findTable } from '@milkdown/kit/prose/tables';
export type EditorActions = { run: (id: string, value?: string) => boolean; find: (query: string, backward?: boolean) => boolean; replace: (query: string, value: string, all: boolean) => number };
export type MenuFlags = Record<string, boolean>;
export function editorFlags(view: EditorView): MenuFlags {
  const { selection, schema, storedMarks, doc } = view.state;
  const { $from, from, to, empty } = selection;
  const flags: MenuFlags = { rich: true, table: false, list: false, task: false };
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'blockquote') flags.quote = true;
    if (node.type.name === 'table') flags.table = true;
    if (node.type.name === 'list_item') { flags.list = true; flags.task = node.attrs.checked !== null; flags['ed:task-done'] = node.attrs.checked === true; flags['ed:task-undone'] = node.attrs.checked === false; }
  }
  flags[`ed:heading-${$from.parent.type.name === 'heading' ? $from.parent.attrs.level : 0}`] = true;
  for (const [id, name] of Object.entries({ bold:'strong', italic:'emphasis', strike:'strike_through', code:'inlineCode' })) {
    const type = schema.marks[name]; flags[`ed:${id}`] = empty ? !!type.isInSet(storedMarks ?? $from.marks()) : doc.rangeHasMark(from,to,type);
  }
  const alignments: string[] = [];
  for (let depth=$from.depth;depth>0;depth--) { const node=$from.node(depth); if (['cell','header_cell'].includes(node.type.spec.tableRole||'')) { alignments.push(node.attrs.alignment || 'left'); break; } }
  doc.nodesBetween(from, to, node => { if (!flags.table && ['paragraph','heading'].includes(node.type.name)) alignments.push(node.attrs.textAlign ?? 'left'); });
  for (const alignment of ['left','center','right','justify']) flags['ed:text-align-'+alignment] = alignments.length > 0 && alignments.every(value => value === alignment);
  flags['ed:unlink'] = doc.rangeHasMark(from, to, schema.marks.link);
  return flags;
}
export function editorActions(view: EditorView, insertTable: (rows:number,cols:number) => boolean): EditorActions {
  const ranges = (query: string) => {
    const matches: {from:number;to:number}[] = [];
    if (!query) return matches;
    view.state.doc.descendants((node, pos) => {
      if (!node.isText) return;
      const text = node.text!.toLocaleLowerCase(), needle = query.toLocaleLowerCase();
      for (let start = text.indexOf(needle); start >= 0; start = text.indexOf(needle, start + needle.length)) matches.push({from:pos+start,to:pos+start+needle.length});
    });
    return matches;
  };
  return {
    run(id, value) {
      const { state } = view; const { schema, selection } = state;
      const apply = (command: import('@milkdown/kit/prose/state').Command) => command(view.state, view.dispatch, view);
      const blockType = (type: import('@milkdown/kit/prose/model').NodeType, attrs?: Record<string, unknown>) => {
        return setBlockType(type, attrs)(state, tr => {
          state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (!node.isTextblock || !node.attrs.textAlign) return;
            const mapped = tr.mapping.map(pos, -1), next = tr.doc.nodeAt(mapped);
            if (next && ['paragraph','heading'].includes(next.type.name)) tr.setNodeMarkup(mapped, undefined, { ...next.attrs, textAlign: node.attrs.textAlign });
          });
          view.dispatch(tr);
        });
      };
      let result = false;
      if (/^heading-[0-6]$/.test(id)) result = blockType(Number(id.slice(8)) ? schema.nodes.heading : schema.nodes.paragraph, Number(id.slice(8)) ? {level:Number(id.slice(8))} : undefined);
      else if (id === 'heading-up' || id === 'heading-down') { const level = selection.$from.parent.attrs.level ?? 0; const next = Math.min(6,Math.max(1,level + (id === 'heading-up' ? -1 : 1))); result = blockType(schema.nodes.heading,{level:next}); }
      else if (id.startsWith('text-align-')) {
        const alignment = id.slice(11);
        if (editorFlags(view).table) return alignment !== 'justify' && editorActions(view, insertTable).run('align-'+alignment);
        if (['left','center','right','justify'].includes(alignment)) {
          const tr = state.tr;
          state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            const parent = state.doc.resolve(pos).parent;
            if (['cell','header_cell'].includes(parent.type.spec.tableRole || '')) return;
            if (['paragraph','heading'].includes(node.type.name)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: alignment });
          });
          if (tr.docChanged) { view.dispatch(tr); result = true; }
        }
      }
      else if (['bold','italic','strike','code'].includes(id)) result = apply(toggleMark(schema.marks[({bold:'strong',italic:'emphasis',strike:'strike_through',code:'inlineCode'} as Record<string,string>)[id]]));
      else {
        const commands: Record<string, import('@milkdown/kit/prose/state').Command> = {
          undo, redo, quote:wrapIn(schema.nodes.blockquote), 'unquote':lift,
          'code-block':setBlockType(schema.nodes.code_block), bullet:wrapInList(schema.nodes.bullet_list), ordered:wrapInList(schema.nodes.ordered_list),
          indent:sinkListItem(schema.nodes.list_item), outdent:liftListItem(schema.nodes.list_item),
          'row-before':addRowBefore, 'row-after':addRowAfter, 'col-before':addColumnBefore, 'col-after':addColumnAfter,
          'delete-row':deleteRow, 'delete-col':deleteColumn, 'delete-table':deleteTable,
        };
        if (commands[id]) result = apply(commands[id]);
        else if (id === 'table') {
          const [rows,cols]=(value||'3,3').split(',').map(Number);
          if(Number.isInteger(rows)&&Number.isInteger(cols)&&rows>=1&&rows<=100&&cols>=1&&cols<=20) result=insertTable(rows,cols);
        } else if (id.startsWith('align-')) {
          const table=findTable(selection.$from), alignment=id.slice(6);
          if(table && ['left','center','right'].includes(alignment)) {
            const map=TableMap.get(table.node);
            let cell=selection.$from.depth; while(cell>0 && !['cell','header_cell'].includes(selection.$from.node(cell).type.spec.tableRole||''))cell--;
            if(cell>0){const col=map.colCount(selection.$from.before(cell)-table.start);const tr=state.tr;
              for(let row=0;row<map.height;row++){const pos=table.start+map.map[row*map.width+col];const node=tr.doc.nodeAt(pos);if(node)tr.setNodeMarkup(pos,undefined,{...node.attrs,alignment});}
              view.dispatch(tr);result=true;
            }
          }
        }
        else if (id === 'hr') { view.dispatch(state.tr.replaceSelectionWith(schema.nodes.hr.create()).scrollIntoView()); result = true; }
        else if (id === 'clear') { let tr = state.tr.removeMark(selection.from,selection.to); state.doc.nodesBetween(selection.from,selection.to,(node,pos)=>{if(node.attrs.textAlign)tr.setNodeMarkup(pos,undefined,{...node.attrs,textAlign:null});}); if (selection.empty) tr = tr.setStoredMarks([]); view.dispatch(tr); result = true; }
        else if (id === 'unlink') { view.dispatch(state.tr.removeMark(selection.from,selection.to,schema.marks.link).removeStoredMark(schema.marks.link)); result = true; }
        else if (id === 'link' && value) { const mark = schema.marks.link.create({href:value}); const tr = selection.empty ? state.tr.replaceSelectionWith(schema.text(value,[mark]),false) : state.tr.addMark(selection.from,selection.to,mark); view.dispatch(tr.scrollIntoView()); result = true; }
        else if (id === 'task' || id === 'task-done' || id === 'task-undone') {
          if (id === 'task' && !editorFlags(view).list) apply(wrapInList(schema.nodes.bullet_list));
          const {$from} = view.state.selection;
          for (let d = $from.depth; d > 0; d--) { const node = $from.node(d); if (node.type.name === 'list_item') { view.dispatch(view.state.tr.setNodeMarkup($from.before(d),undefined,{...node.attrs,checked:id === 'task-done'})); result = true; break; } }
        } else if (id === 'paragraph-before' || id === 'paragraph-after') {
          const {$from} = selection; const pos = id === 'paragraph-before' ? $from.before(1) : $from.after(1);
          const tr = state.tr.insert(pos,schema.nodes.paragraph.create()); tr.setSelection(TextSelection.create(tr.doc,pos+1)); view.dispatch(tr.scrollIntoView()); result = true;
        }
      }
      if (result) view.focus(); return result;
    },
    find(query, backward = false) {
      const matches = ranges(query); if (!matches.length) return false;
      const {from,to} = view.state.selection;
      const match = backward ? [...matches].reverse().find(m => m.to <= from) ?? matches[matches.length-1] : matches.find(m => m.from >= to) ?? matches[0];
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,match.from,match.to)).scrollIntoView()); view.focus(); return true;
    },
    replace(query, value, all) {
      let matches = ranges(query); if (!all) matches = matches.filter(m => m.from === view.state.selection.from && m.to === view.state.selection.to);
      if (!matches.length) return 0;
      const tr = view.state.tr; for (const m of matches.reverse()) tr.insertText(value,m.from,m.to); view.dispatch(tr.scrollIntoView()); return matches.length;
    },
  };
}
