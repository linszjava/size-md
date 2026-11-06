import type { EditorView } from '@milkdown/kit/prose/view';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { NodeSelection } from '@milkdown/kit/prose/state';
import { closeHistory } from '@milkdown/kit/prose/history';
import { imageColumnsTitle } from './image-size';

// Only combine adjacent image-only paragraphs. Never move intervening text.
export function layoutImages(view: EditorView, columns: number): string | null {
  const selection=view.state.selection;
  if(!(selection instanceof NodeSelection)||selection.node.type.name!=='image')return '请先选中图片';
  const $pos=selection.$from;
  if($pos.parent.type.name!=='paragraph'||$pos.depth<1)return '请把图片放在单独的段落中';
  const images=(node:ProseNode) => {
    const result:ProseNode[]=[];let valid=node.type.name==='paragraph';
    node.forEach(child=>{if(child.type.name==='image')result.push(child);else if(!child.isText||child.text?.trim())valid=false;});
    return valid && result.length ? result : null;
  };
  const current=images($pos.parent);
  if(!current)return '图片旁有正文，请先把图片单独放一段';
  const from=$pos.before();let to=$pos.after();let all=[...current];
  if(columns>1){
    const parent=$pos.node($pos.depth-1);let next=$pos.index($pos.depth-1)+1;
    while(all.length<columns&&next<parent.childCount){
      const block=parent.child(next++);const found=images(block);
      if(!found)break;
      all.push(...found);to+=block.nodeSize;
    }
    if(all.length<columns)return `需要 ${columns} 张相邻图片，请先在当前图片下方插入图片`;
  }
  const blocks:ProseNode[]=[];
  for(let index=0;index<all.length;index+=columns){
    const group=all.slice(index,index+columns),count=group.length;
    const content:ProseNode[]=[];
    group.forEach((node,i)=>{
      if(i)content.push(view.state.schema.text(' '));
      content.push(node.type.create({...node.attrs,title:imageColumnsTitle(node.attrs.title,count)},null,node.marks));
    });
    blocks.push($pos.parent.type.create($pos.parent.attrs,content));
  }
  const tr=closeHistory(view.state.tr).replaceWith(from,to,blocks);
  tr.setSelection(NodeSelection.create(tr.doc,from+1));view.dispatch(tr.scrollIntoView());view.focus();return null;
}
