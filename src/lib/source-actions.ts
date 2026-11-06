import type { EditorView } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';
import type { EditorActions } from './editor-actions';
export function sourceActions(view: EditorView): EditorActions {
  const matches = (q: string) => {
    const result: {from:number;to:number}[] = []; if (!q) return result;
    const text = view.state.doc.toString().toLocaleLowerCase(), needle = q.toLocaleLowerCase();
    for (let i=text.indexOf(needle);i>=0;i=text.indexOf(needle,i+needle.length)) result.push({from:i,to:i+needle.length});
    return result;
  };
  return {
    run(id) { const ok = id === 'undo' ? undo(view) : id === 'redo' ? redo(view) : false; view.focus(); return ok; },
    find(q, backward=false) { const list=matches(q); if (!list.length) return false; const {from,to}=view.state.selection.main; const m=backward ? [...list].reverse().find(m=>m.to<=from)??list[list.length-1] : list.find(m=>m.from>=to)??list[0]; view.dispatch({selection:{anchor:m.from,head:m.to},scrollIntoView:true}); view.focus(); return true; },
    replace(q,value,all) { const {from,to}=view.state.selection.main; const list=matches(q).filter(m=>all || m.from===from && m.to===to); if(list.length) view.dispatch({changes:list.map(m=>({...m,insert:value})),scrollIntoView:true}); return list.length; },
  };
}
