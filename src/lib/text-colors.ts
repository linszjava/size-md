import type { Processor } from 'unified';
import type { Root, Parent, RootContent } from 'mdast';

export const colorPattern = /^#[0-9a-f]{6}$/i;
const opening = /^<span style="(color|background-color):(#[0-9a-f]{6})">$/i;
export function withoutColorSpans(source: string) {
  let previous='';
  while(previous!==source){previous=source;source=source.replace(/<span style="(?:color|background-color):#[0-9a-f]{6}">((?:(?!<span|<\/span>)[\s\S])*?)<\/span>/gi, '$1');}
  return source;
}
// Only our two hex-color attributes are interpreted; arbitrary HTML/CSS stays unsupported.
export function textColors(this: Processor) {
  const data=this.data();
  data.toMarkdownExtensions=[...(data.toMarkdownExtensions||[]) as object[], {handlers:{
    textColor(node: Parent & {color:string;property:string}, _: unknown, state: {containerPhrasing:(node:Parent,info:unknown)=>string}, info: unknown) {
      return `<span style="${node.property}:${node.color}">${state.containerPhrasing(node,info)}</span>`;
    }
  }}];
  return (tree:Root)=>{
    function visit(parent:Parent) {
      const output:RootContent[]=[];
      for(let i=0;i<parent.children.length;i++) {
        const node=parent.children[i];
        const match=node.type==='html'?opening.exec(node.value):null;
        if(match){
          let depth=1,j=i+1;
          for(;j<parent.children.length;j++) {const next=parent.children[j];if(next.type==='html'){if(opening.test(next.value))depth++;else if(next.value==='</span>')depth--;if(!depth)break;}}
          if(!depth){
            const colored={type:'textColor',property:match[1].toLowerCase(),color:match[2].toLowerCase(),children:parent.children.slice(i+1,j),data:{hName:'span',hProperties:{'dataTextColor':match[1]==='color'?match[2]:undefined,'dataBackgroundColor':match[1]==='background-color'?match[2]:undefined}}};
            visit(colored as unknown as Parent);output.push(colored as unknown as RootContent);i=j;continue;
          }
        }
        if('children' in node)visit(node as Parent);
        output.push(node);
      }
      parent.children=output as typeof parent.children;
    }
    visit(tree);
  };
}
