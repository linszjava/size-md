import items from '../lib/menu-items.json';
import type { MenuFlags } from '../lib/editor-actions';
type Entry = { id?: string; label?: string; separator?: boolean; gate?: string; check?: boolean; children?: Entry[] };
export default function EditingMenu({flags, onAction}: {flags: MenuFlags; onAction: (id:string) => void}) {
  function render(list: Entry[]) { return list.map((item,i) => item.separator ? <hr key={i}/> : item.children ? <details key={i}><summary>{item.label}</summary><div>{render(item.children)}</div></details> : <button key={i} disabled={!!item.gate && !flags[item.gate]} onMouseDown={e => e.preventDefault()} onClick={() => onAction(item.id!)}>{item.check && flags[item.id!] ? '✓ ' : ''}{item.label}</button>); }
  return <details className="web-editing web-settings"><summary>编辑</summary><div className="settings-menu">{render([{label:'编辑',children:[{id:'undo',label:'撤销'},{id:'redo',label:'重做'},{id:'find',label:'查找…'},{id:'replace',label:'查找并替换…'}]}, ...items])}</div></details>;
}
