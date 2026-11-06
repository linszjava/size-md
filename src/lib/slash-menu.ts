import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import { closeHistory } from '@milkdown/kit/prose/history';
import type { EditorView } from '@milkdown/kit/prose/view';
const commands = [
  ...['一','二','三','四','五','六'].map((n,i)=>({id:'ed:heading-'+(i+1),name:n+'级标题',hint:'标题 '+(i+1),keywords:'heading h'+(i+1)+' biaoti 标题'+(i+1),icon:'H'+(i+1)})),
  {id:'ed:heading-0',name:'正文',hint:'普通段落',keywords:'text paragraph zhengwen 段落',icon:'¶'},
  {id:'ed:table',name:'表格',hint:'选择行数与列数',keywords:'table biaoge',icon:'▦'},
  {id:'insert-image',name:'图片',hint:'按图片存储设置插入',keywords:'image photo tupian',icon:'▧'},
  {id:'ed:code-block',name:'代码块',hint:'带语法高亮的代码',keywords:'code daima',icon:'</>'},
  {id:'ed:quote',name:'引用',hint:'引用段落',keywords:'quote yinyong',icon:'❞'},
  {id:'ed:task',name:'待办列表',hint:'带勾选框的任务',keywords:'todo task daiban 任务',icon:'☑'},
  {id:'ed:ordered',name:'有序列表',hint:'按数字排列',keywords:'ordered list youxu',icon:'1.'},
  {id:'ed:bullet',name:'无序列表',hint:'项目符号列表',keywords:'bullet list wuxu',icon:'•'},
  {id:'ed:hr',name:'分割线',hint:'水平分割线',keywords:'divider hr fengexian',icon:'—'},
];
let menuCount=0;
export function slashMenu(onCommand:(id:string)=>void) {
  return $prose(()=>{
    let menu:HTMLDivElement|null=null, view:EditorView|null=null;
    let items=commands,active=0,start=-1,end=-1,lastQuery='',dismissed=-1;
    const id='slash-menu-'+(++menuCount);
    function hide(){if(menu)menu.hidden=true;view?.dom.removeAttribute('aria-controls');view?.dom.removeAttribute('aria-activedescendant');}
    function query(){
      if(!view||view.isDestroyed||view.composing)return null;
      const {selection}=view.state,{$from}=selection;
      if(!selection.empty||$from.depth!==1||$from.parent.type.name!=='paragraph'||$from.parentOffset!==$from.parent.content.size)return null;
      const text=$from.parent.textContent;
      if(!/^\/[^\s/]{0,32}$/.test(text))return null;
      return {text:text.slice(1).toLowerCase(),start:$from.start(),end:selection.from};
    }
    function choose(index:number){
      const current=query();if(!view||!current||!items[index])return;
      const command=items[index];hide();
      view.dispatch(closeHistory(view.state.tr).delete(current.start,current.end));view.focus();onCommand(command.id);
    }
    function position(){
      if(!view||!menu||menu.hidden)return;
      const pane=view.dom.closest('.editor-pane');if(!pane)return;
      const bounds=pane.getBoundingClientRect(),caret=view.coordsAtPos(end);
      if(caret.top<bounds.top||caret.bottom>bounds.bottom){hide();return;}
      const height=menu.offsetHeight,width=menu.offsetWidth;
      menu.style.left=Math.max(8,Math.min(caret.left,window.innerWidth-width-12))+'px';
      menu.style.top=Math.max(bounds.top+4,caret.bottom+height+8<bounds.bottom?caret.bottom+7:caret.top-height-7)+'px';
    }
    function highlight(){if(!menu||!view)return;menu.querySelectorAll('[role=option]').forEach((el,i)=>{el.setAttribute('aria-selected',String(i===active));});view.dom.setAttribute('aria-activedescendant',id+'-'+active);menu.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});}
    function render(){
      if(!view||!menu)return;
      const current=query();
      if(!current){dismissed=-1;start=-1;hide();return;}
      if(current.start===dismissed||!view.hasFocus()){hide();return;}
      if(current.text!==lastQuery||current.start!==start)active=0;
      start=current.start;end=current.end;lastQuery=current.text;
      items=commands.filter(c=>(c.name+' '+c.keywords).toLowerCase().includes(current.text));active=Math.min(active,Math.max(0,items.length-1));
      menu.replaceChildren();const title=document.createElement('div');title.className='slash-menu-title';title.textContent=current.text?'筛选命令':'插入内容';menu.append(title);
      if(!items.length){const empty=document.createElement('p');empty.textContent='没有匹配命令';menu.append(empty);}
      items.forEach((command,index)=>{
        const row=document.createElement('div');row.id=id+'-'+index;row.setAttribute('role','option');row.setAttribute('aria-label',command.name);
        const icon=document.createElement('span');icon.className='slash-icon';icon.textContent=command.icon;
        const label=document.createElement('span');label.textContent=command.name;const hint=document.createElement('small');hint.textContent=command.hint;label.append(hint);row.append(icon,label);
        row.onpointermove=()=>{active=index;highlight();};row.onclick=()=>choose(index);menu!.append(row);
      });
      menu.hidden=false;view.dom.setAttribute('aria-controls',id);position();highlight();
    }
    return new Plugin({
      props:{handleKeyDown(_view,event){
        if(event.isComposing||_view.composing||event.keyCode===229||!menu||menu.hidden)return false;
        if(event.key==='Escape'){dismissed=start;hide();event.preventDefault();return true;}
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){if(items.length){active=(active+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;highlight();}event.preventDefault();return true;}
        if(event.key==='Enter'&&items.length){event.preventDefault();choose(active);return true;}
        return false;
      },handleDOMEvents:{blur(){hide();return false;},focus(){queueMicrotask(render);return false;},compositionstart(){hide();return false;},compositionend(){setTimeout(render,0);return false;}}},
      view(editor){view=editor;menu=document.createElement('div');menu.id=id;menu.className='slash-menu';menu.setAttribute('role','listbox');menu.setAttribute('aria-label','斜杠命令');menu.hidden=true;menu.onmousedown=e=>e.preventDefault();document.body.append(menu);
        const outside=(event:PointerEvent)=>{if(menu&&!menu.contains(event.target as Node)&&!view?.dom.contains(event.target as Node)){dismissed=start;hide();}};
        const scroll=(event:Event)=>{if(!menu?.contains(event.target as Node))position();};
        document.addEventListener('pointerdown',outside);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',position);
        return {update(){render();},destroy(){hide();menu?.remove();menu=null;view=null;document.removeEventListener('pointerdown',outside);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',position);}};
      }
    });
  });
}
