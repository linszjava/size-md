import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Table2, AlignLeft, AlignCenter, AlignRight, Rows3, Columns3, Minus, Plus, Trash2 } from 'lucide-react';
import type { EditorView } from '@milkdown/kit/prose/view';
import { TextSelection } from '@milkdown/kit/prose/state';
import { closeHistory } from '@milkdown/kit/prose/history';
import { findTable, TableMap } from '@milkdown/kit/prose/tables';
import { editorActions } from '../lib/editor-actions';
type Anchor = { left:number; top:number; width:number; rows:number; cols:number; pos:number };
export default function TableTools({view}:{view:EditorView}) {
  const [anchor,setAnchor]=useState<Anchor|null>(null),[open,setOpen]=useState(false);
  const [rows,setRows]=useState(1),[cols,setCols]=useState(1),[error,setError]=useState('');
  useEffect(()=>{
    let tablePos=-1;
    const update=()=>{
      if(view.isDestroyed)return;
      const table=findTable(view.state.selection.$from);
      const node=(table&&view.nodeDOM(table.pos)) as HTMLElement|null;
      const dom=node?.matches('table')?node:node?.querySelector('table');
      const pane=view.dom.closest('.editor-pane');
      if(!table||!dom||!pane){setAnchor(null);setOpen(false);tablePos=-1;return;}
      const rect=dom.getBoundingClientRect(),bounds=pane.getBoundingClientRect(),map=TableMap.get(table.node);
      if(rect.bottom<bounds.top+38||rect.top>bounds.bottom){setAnchor(null);return;}
      if(tablePos!==table.pos){setOpen(false);setError('');tablePos=table.pos;}
      setAnchor({left:Math.max(bounds.left+4,rect.left),top:Math.max(bounds.top+3,rect.top-32),width:Math.min(rect.width,bounds.right-rect.left-4),rows:map.height,cols:map.width,pos:table.pos});
    };
    update();view.dom.addEventListener('table-change',update);document.addEventListener('scroll',update,true);window.addEventListener('resize',update);
    const observer=new ResizeObserver(update);observer.observe(view.dom);
    return()=>{view.dom.removeEventListener('table-change',update);document.removeEventListener('scroll',update,true);window.removeEventListener('resize',update);observer.disconnect();};
  },[view]);
  useEffect(()=>{
    if(!open)return;
    const outside=(e:PointerEvent)=>{if(!(e.target as HTMLElement).closest('.inline-table-tools'))setOpen(false);};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  if(!anchor)return null;
  const run=(id:string)=>{setOpen(false);editorActions(view,()=>false).run(id);};
  function resize(r:number,c:number){
    if(!Number.isInteger(r)||!Number.isInteger(c)||r<2||r>100||c<1||c>20){setError('至少保留表头和一行正文；行数为 2–100，列数为 1–20。');return;}
    const table=findTable(view.state.selection.$from);if(!table)return;
    for(let y=0;y<table.node.childCount;y++){
      const row=table.node.child(y);
      for(let x=0;x<row.childCount;x++){
        const cell=row.child(x);
        if(cell.attrs.colspan!==1||cell.attrs.rowspan!==1){setError('合并单元格暂不支持尺寸调整。');return;}
        if((y>=r||x>=c)&&Array.from({length:cell.childCount},(_,i)=>cell.child(i)).some(n=>n.type.name!=='paragraph'||n.content.size>0)){setError('缩小区域内有内容，请先移动或清空，再调整尺寸。');return;}
      }
    }
    const schema=view.state.schema;
    const rowNodes=Array.from({length:r},(_,y)=>{
      const old=y<table.node.childCount?table.node.child(y):null;
      const cells=Array.from({length:c},(_,x)=>old&&x<old.childCount?old.child(x):(y===0?schema.nodes.table_header:schema.nodes.table_cell).createAndFill({alignment:x<table.node.firstChild!.childCount?table.node.firstChild!.child(x).attrs.alignment:null})!);
      return (old?.type||(y===0?schema.nodes.table_header_row:schema.nodes.table_row)).create(old?.attrs,cells);
    });
    const tr=closeHistory(view.state.tr).replaceWith(table.pos,table.pos+table.node.nodeSize,table.node.type.create(table.node.attrs,rowNodes));
    tr.setSelection(TextSelection.near(tr.doc.resolve(table.pos+3)));view.dispatch(tr.scrollIntoView());setOpen(false);setError('');view.focus();
  }
  return createPortal(<div className="inline-table-tools" style={{left:anchor.left,top:anchor.top,width:Math.max(280,anchor.width)}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);view.focus();}}}>
    <div className="table-icon-bar" role="toolbar" aria-label="表格工具" onMouseDown={e=>e.preventDefault()}>
      <button title="调整表格尺寸" aria-label="调整表格尺寸" aria-expanded={open} onClick={()=>{setRows(anchor.rows);setCols(anchor.cols);setError('');setOpen(!open);}}><Table2 size={16}/></button>
      <button title="列左对齐" aria-label="列左对齐" onClick={()=>run('align-left')}><AlignLeft size={16}/></button><button title="列居中" aria-label="列居中" onClick={()=>run('align-center')}><AlignCenter size={16}/></button><button title="列右对齐" aria-label="列右对齐" onClick={()=>run('align-right')}><AlignRight size={16}/></button>
      <i/><button title="下方加行" aria-label="下方加行" onClick={()=>run('row-after')}><Rows3 size={15}/><Plus size={9}/></button><button title="右侧加列" aria-label="右侧加列" onClick={()=>run('col-after')}><Columns3 size={15}/><Plus size={9}/></button><button title="删除行" aria-label="删除行" onClick={()=>run('delete-row')}><Rows3 size={15}/><Minus size={9}/></button><button title="删除列" aria-label="删除列" onClick={()=>run('delete-col')}><Columns3 size={15}/><Minus size={9}/></button><i/><button title="删除整个表格（⌘Z 可撤销）" aria-label="删除整个表格" onClick={()=>run('delete-table')}><Trash2 size={15}/></button><small>{anchor.cols} × {anchor.rows}</small>
    </div>
    {open&&<div className="table-size-popover" style={{maxHeight:Math.max(180,window.innerHeight-anchor.top-48)}} role="dialog" aria-label="调整表格尺寸"><div className="table-size-grid">{Array.from({length:64},(_,i)=>{const r=Math.floor(i/8)+1,c=i%8+1;return <button key={i} type="button" aria-label={'调整为 '+r+' 行 '+c+' 列'} className={r<=rows&&c<=cols?'selected':''} onMouseEnter={()=>{setRows(r);setCols(c);}} onClick={()=>resize(r,c)}/>;})}</div><div className="table-dimensions"><label>列<input aria-label="表格列数" type="number" min="1" max="20" value={cols||''} onChange={e=>setCols(Number(e.target.value))}/></label><span>×</span><label>行<input aria-label="表格行数" type="number" min="2" max="100" value={rows||''} onChange={e=>setRows(Number(e.target.value))}/></label></div>{error&&<p role="alert">{error}</p>}<button className="apply-table-size" onClick={()=>resize(rows,cols)}>应用尺寸</button></div>}
  </div>,document.body);
}
