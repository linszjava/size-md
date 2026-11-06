import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Strikethrough, Code, Quote, List, ListOrdered, ListTodo, Table2, Link2, ImagePlus, Minus, RemoveFormatting, ChevronDown, X, SquareCode, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import type { MenuFlags } from '../lib/editor-actions';
export default function ArticleToolbar({flags,disabled,onCommand,onClose}:{flags:MenuFlags;disabled:boolean;onCommand:(id:string)=>void;onClose:()=>void}) {
  const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[]);
  const headings=['正文','一级标题','二级标题','三级标题','四级标题','五级标题','六级标题'];
  const level=headings.findIndex((_,i)=>flags[`ed:heading-${i}`]);
  const groups=[
    [{id:'ed:bold',label:'加粗',icon:Bold},{id:'ed:italic',label:'斜体',icon:Italic},{id:'ed:strike',label:'删除线',icon:Strikethrough},{id:'ed:code',label:'行内代码',icon:Code}],
    [{id:'ed:text-align-left',label:'左对齐',icon:AlignLeft},{id:'ed:text-align-center',label:'居中',icon:AlignCenter},{id:'ed:text-align-right',label:'右对齐',icon:AlignRight},{id:'ed:text-align-justify',label:'两端对齐',icon:AlignJustify}],
    [{id:'ed:quote',label:'引用',icon:Quote},{id:'ed:bullet',label:'无序列表',icon:List},{id:'ed:ordered',label:'有序列表',icon:ListOrdered},{id:'ed:task',label:'任务列表',icon:ListTodo}],
    [{id:'ed:table',label:'插入表格',icon:Table2},{id:'link-dialog',label:'插入链接',icon:Link2},{id:'insert-image',label:'插入图片',icon:ImagePlus},{id:'ed:code-block',label:'代码块',icon:SquareCode},{id:'ed:hr',label:'水平分割线',icon:Minus},{id:'ed:clear',label:'清除格式',icon:RemoveFormatting}],
  ];
  return <div ref={root} className="article-toolbar" role="toolbar" aria-label="文章工具栏" onMouseDown={e=>e.preventDefault()}>
    <div className="article-heading-picker"><button disabled={disabled} type="button" aria-label="段落样式" aria-expanded={open} onClick={()=>setOpen(!open)}>{headings[level]||'段落'}<ChevronDown size={12}/></button>{open&&<div className="article-heading-options" role="menu" aria-label="段落样式">{headings.map((label,i)=><button disabled={disabled} key={i} role="menuitemradio" aria-checked={i===level} onClick={()=>{onCommand(`ed:heading-${i}`);setOpen(false);}}>{label}<small>{i?'H'+i:'¶'}</small></button>)}</div>}</div>
    <div className="article-toolbar-scroll">{groups.map((group,i)=><div className="article-tool-group" key={i}>{group.map(({id,label,icon:Icon})=><button disabled={disabled||(id==='ed:text-align-justify'&&flags.table)} key={id} type="button" title={label} aria-label={label} aria-pressed={id in flags?flags[id]:undefined} onClick={()=>{setOpen(false);onCommand(id);}}><Icon size={16}/></button>)}</div>)}</div>
    <button className="article-toolbar-close" title="关闭工具栏，可在设置 → 编辑器重新开启" aria-label="关闭文章工具栏" onClick={onClose}><X size={14}/></button>
  </div>;
}
