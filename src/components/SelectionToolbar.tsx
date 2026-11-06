import ChoiceSelect from './ChoiceSelect';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Strikethrough, Code, Link2, RemoveFormatting, Baseline, Highlighter, AlignLeft, AlignCenter, AlignRight, AlignJustify, Ellipsis, Quote, List, ListOrdered, ListTodo, SquareCode, Unlink, IndentIncrease, IndentDecrease } from 'lucide-react';
import type { EditorView } from '@milkdown/kit/prose/view';
import { TextSelection } from '@milkdown/kit/prose/state';
import { editorActions, editorFlags, type MenuFlags } from '../lib/editor-actions';
type Position = {left:number;top:number;flags:MenuFlags};
export default function SelectionToolbar({view,onCommand}:{view:EditorView;onCommand:(id:string)=>void}) {
  const root = useRef<HTMLDivElement>(null);
  const [more,setMore]=useState(false);
  const [palette,setPalette]=useState<'textColor'|'backgroundColor'|null>(null);
  const [position,setPosition]=useState<Position|null>(null);
  useEffect(()=>{
    let dismissed='',frame=0;
    function update(){
      if(view.isDestroyed)return;
      const {selection}=view.state;
      if(!['text','all'].includes(selection.toJSON().type)||selection.empty){dismissed='';setPosition(null);setPalette(null);return;}
      if((!view.hasFocus()&&!root.current?.contains(document.activeElement))||view.composing||selection.$from.parent.type.spec.code||selection.$to.parent.type.spec.code){setPosition(null);setPalette(null);return;}
      if(selection.toJSON().type==='all'){const text=TextSelection.between(selection.$from,selection.$to);if(!text.empty){view.dispatch(view.state.tr.setSelection(text));return;}}
      const key=selection.from+':'+selection.to;
      if(key===dismissed){setPosition(null);setPalette(null);return;}
      dismissed='';
      const pane=view.dom.closest('.editor-pane');if(!pane)return;
      const bounds=pane.getBoundingClientRect(),start=view.coordsAtPos(selection.from),end=view.coordsAtPos(selection.to);
      if(end.bottom<bounds.top||start.top>bounds.bottom){setPosition(null);setPalette(null);return;}
      const left=Math.max(bounds.left+6,Math.min((start.left+end.right)/2-160,bounds.right-326));
      
      const top=start.top-78>=bounds.top?start.top-78:Math.min(end.bottom+7,bounds.bottom-76);
      setPosition({left,top,flags:editorFlags(view)});
    }
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){dismissed=view.state.selection.from+':'+view.state.selection.to;setPosition(null);setPalette(null);}};
    view.dom.addEventListener('table-change',schedule);view.dom.addEventListener('focus',schedule);view.dom.addEventListener('blur',schedule);view.dom.addEventListener('keydown',escape);
    document.addEventListener('selectionchange',schedule);document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);update();
    return()=>{cancelAnimationFrame(frame);view.dom.removeEventListener('table-change',schedule);view.dom.removeEventListener('focus',schedule);view.dom.removeEventListener('blur',schedule);view.dom.removeEventListener('keydown',escape);document.removeEventListener('selectionchange',schedule);document.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);};
  },[view]);
  if(!position)return null;
  const run = (id:string) => { editorActions(view,()=>false).run(id); setMore(false); };
  const headings=['正文','一级标题','二级标题','三级标题','四级标题','五级标题','六级标题'];
  const level=Math.max(0,headings.findIndex((_,i)=>position.flags['ed:heading-'+i]));
  function applyColor(color:string|null){
    if(!palette)return;
    const {state}=view,type=state.schema.marks[palette];
    if(!type)return;
    const tr=state.tr.removeMark(state.selection.from,state.selection.to,type);
    if(color)tr.addMark(state.selection.from,state.selection.to,type.create({color}));
    view.dispatch(tr);view.focus();setPalette(null);
  }
  const colors=palette==='textColor'?[['灰色','#787774'],['棕色','#9f6b53'],['橙色','#d9730d'],['红色','#d44c47'],['紫色','#9065b0'],['蓝色','#337ea9'],['绿色','#448361'],['黑色','#242424']]:[['浅黄','#fff2a8'],['浅灰','#e9e9e7'],['浅棕','#f0e3da'],['浅橙','#fde5cd'],['浅红','#fbe4e4'],['浅紫','#eee0f5'],['浅蓝','#dceefa'],['浅绿','#dceee2']];
  const actions=[{id:'bold',label:'加粗',icon:Bold},{id:'italic',label:'斜体',icon:Italic},{id:'strike',label:'删除线',icon:Strikethrough},{id:'code',label:'行内代码',icon:Code}];
  return createPortal(<div ref={root} className="selection-format-bar" role="toolbar" aria-label="选中文字格式" style={{left:position.left,top:position.top}} onMouseDown={e=>e.preventDefault()}>
    <div className="selection-tools-row">{actions.map(({id,label,icon:Icon})=><button key={id} type="button" title={label} aria-label={label} aria-pressed={!!position.flags['ed:'+id]} onClick={()=>editorActions(view,()=>false).run(id)}><Icon size={16}/></button>)}
    <i/>{([{id:'textColor',label:'文字颜色',icon:Baseline},{id:'backgroundColor',label:'背景高亮',icon:Highlighter}] as const).map(({id,label,icon:Icon})=><button key={id} type="button" title={label} aria-label={label} aria-expanded={palette===id} onClick={()=>{setMore(false);setPalette(palette===id?null:id);}}><Icon size={16}/></button>)}
    {palette&&<div className="format-color-palette" style={position.top+142>window.innerHeight?{top:'auto',bottom:'calc(100% + 7px)'}:undefined} role="group" aria-label={palette==='textColor'?'文字颜色选择':'背景高亮选择'}><div className="format-color-heading">{palette==='textColor'?'文字颜色':'背景高亮'}<button type="button" onClick={()=>applyColor(null)}>恢复默认</button></div><div className="format-color-grid">{colors.map(([label,color])=><button type="button" key={color} title={label} aria-label={label} onClick={()=>applyColor(color)}><span style={{background:palette==='backgroundColor'?color:undefined,color:palette==='textColor'?color:undefined}}>A</span></button>)}</div></div>}
    <i/><button type="button" title="插入链接" aria-label="插入链接" onClick={()=>{setPosition(null);onCommand('link-dialog');}}><Link2 size={16}/></button><button type="button" title="清除格式" aria-label="清除格式" onClick={()=>editorActions(view,()=>false).run('clear')}><RemoveFormatting size={16}/></button>
    </div>
    <div className="selection-tools-row selection-block-row">
      <ChoiceSelect label="选区段落样式" value={level} onValueChange={value=>run('heading-'+value)}>{headings.map((label,i)=><option key={i} value={i}>{label}</option>)}</ChoiceSelect>
      <i/>{[{id:'left',label:'左对齐',icon:AlignLeft},{id:'center',label:'居中',icon:AlignCenter},{id:'right',label:'右对齐',icon:AlignRight},{id:'justify',label:'两端对齐',icon:AlignJustify}].map(({id,label,icon:Icon})=><button key={id} type="button" disabled={id==='justify'&&position.flags.table} title={label+(position.flags.table?'（所在列）':'（所在段落）')} aria-label={label} aria-pressed={!!position.flags['ed:text-align-'+id]} onClick={()=>run('text-align-'+id)}><Icon size={16}/></button>)}
      <i/><button type="button" title="更多段落工具" aria-label="更多段落工具" aria-expanded={more} onClick={()=>{setPalette(null);setMore(!more);}}><Ellipsis size={16}/></button>
    </div>
    {more&&<div className="selection-more-menu" role="group" aria-label="更多段落工具" style={position.top+300>window.innerHeight?{top:'auto',bottom:'calc(100% + 7px)'}:undefined}>
      {[{id:'quote',label:'引用',icon:Quote},{id:'unquote',label:'取消引用',icon:Quote},{id:'bullet',label:'无序列表',icon:List},{id:'ordered',label:'有序列表',icon:ListOrdered},{id:'task',label:'任务列表',icon:ListTodo},{id:'code-block',label:'代码块',icon:SquareCode},{id:'indent',label:'增加缩进',icon:IndentIncrease},{id:'outdent',label:'减少缩进',icon:IndentDecrease},{id:'unlink',label:'移除链接',icon:Unlink}].map(({id,label,icon:Icon})=><button key={id} type="button" disabled={(['indent','outdent'].includes(id)&&!position.flags.list)||(id==='unquote'&&!position.flags.quote)||(id==='unlink'&&!position.flags['ed:unlink'])} onClick={()=>run(id)}><Icon size={15}/>{label}</button>)}
    </div>}
  </div>,document.body);
}
