import { $markSchema } from '@milkdown/kit/utils';
import { colorPattern } from './text-colors';
export const colorEditor=['color','background-color'].flatMap(property=>{
  const name=property==='color'?'textColor':'backgroundColor';
  return [...$markSchema(name,()=>({
    attrs:{color:{default:null}},
    parseDOM:[{tag:'span[style]',getAttrs:dom=>{const value=(dom as HTMLElement).style.getPropertyValue(property);const hex=/^#[0-9a-f]{6}$/i.test(value)?value:null;const rgb=/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value);const color=hex||(rgb?'#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):null);return color?{color}:false;}}],
    toDOM:mark=>['span',{style:`${property}:${colorPattern.test(mark.attrs.color)?mark.attrs.color:'inherit'}`},0],
    parseMarkdown:{match:node=>node.type==='textColor'&&node.property===property,runner:(state,node,type)=>{state.openMark(type,{color:node.color});state.next(node.children);state.closeMark(type);}},
    toMarkdown:{match:mark=>mark.type.name===name,runner:(state,mark)=>{state.withMark(mark,'textColor',undefined,{color:mark.attrs.color,property});}},
  }))];
});
