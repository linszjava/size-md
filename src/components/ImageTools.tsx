import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, RotateCcw, Trash2 } from 'lucide-react';
import { NodeSelection } from '@milkdown/kit/prose/state';
import { closeHistory } from '@milkdown/kit/prose/history';
import type { EditorView } from '@milkdown/kit/prose/view';
import ChoiceSelect from './ChoiceSelect';
import { layoutImages } from '../lib/image-layout';
import { imageColumns, imageSize, imageSizeTitle } from '../lib/image-size';

type Anchor = { left: number; top: number; width: number; natural: number; columns: number };
export default function ImageTools({ view }: { view: EditorView }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const update = () => {
      if (view.isDestroyed) return;
      const selection = view.state.selection;
      if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') { setAnchor(null); setMessage(''); return; }
      const img = view.nodeDOM(selection.from);
      if (!(img instanceof HTMLImageElement)) { setAnchor(null); return; }
      const rect = img.getBoundingClientRect();
      const pane = view.dom.closest('.editor-pane')?.getBoundingClientRect();
      if (!pane || rect.bottom < pane.top || rect.top > pane.bottom) { setAnchor(null); return; }
      setAnchor({ left: Math.max(pane.left + 8, Math.min(rect.left, window.innerWidth - 450)), top: Math.max(pane.top + 6, Math.min(rect.top - 42, pane.bottom - 45)), width: imageSize(selection.node.attrs.title).width || img.naturalWidth, natural: img.naturalWidth, columns: imageColumns(selection.node.attrs.title).columns });
    };
    update();
    view.dom.addEventListener('table-change', update);
    view.dom.addEventListener('load', update, true);
    document.addEventListener('scroll', update, true); window.addEventListener('resize', update);
    return () => { view.dom.removeEventListener('table-change', update); view.dom.removeEventListener('load', update, true); document.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [view]);
  if (!anchor) return null;
  const selected = () => { const s = view.state.selection; return s instanceof NodeSelection && s.node.type.name === 'image' ? s : null; };
  const resize = (width: number | null) => {
    const s = selected(); if (!s) return;
    view.dispatch(closeHistory(view.state.tr).setNodeMarkup(s.from, undefined, { ...s.node.attrs, title: imageSizeTitle(s.node.attrs.title, width) }));
    setMessage(''); view.focus();
  };
  const percent = anchor.natural ? Math.round(anchor.width / anchor.natural * 100) : 100;
  const percentages = [...new Set([25, 33, 50, 67, 100, 150, 200, percent])].sort((a,b) => a-b);
  return createPortal(<div className="image-tools" role="toolbar" aria-label="图片工具" style={{ left: anchor.left, top: anchor.top }} onKeyDown={e => { if (e.key === 'Escape') { setAnchor(null); view.focus(); } }}>
    <ChoiceSelect label="缩放图片" value={percent} disabled={!anchor.natural || anchor.columns>1} onValueChange={v => resize(Math.max(16, Math.min(16000, Math.round(anchor.natural * Number(v) / 100))))}>{percentages.map(p => <option key={p} value={p}>{p}%</option>)}</ChoiceSelect>
    <ChoiceSelect label="图片排列" value={anchor.columns} onValueChange={v=>{const error=layoutImages(view,Number(v));setMessage(error||'');}}><option value={1}>独占一行</option><option value={2}>两图并排</option><option value={3}>三图并排</option></ChoiceSelect>
    <button disabled={anchor.columns>1} title="恢复原尺寸" aria-label="恢复原尺寸" onMouseDown={e=>e.preventDefault()} onClick={()=>resize(null)}><RotateCcw size={16}/></button>
    <button title="复制图片网址" aria-label="复制图片网址" onMouseDown={e=>e.preventDefault()} onClick={async()=>{ const s=selected(); if(!s)return; try { const src=String(s.node.attrs.src); if ('__TAURI_INTERNALS__' in window) { const {writeText}=await import('@tauri-apps/plugin-clipboard-manager'); await writeText(src); } else await navigator.clipboard.writeText(src); setMessage('已复制网址'); } catch { setMessage('复制失败，请重试'); } }}><Copy size={16}/></button>
    <i/>
    <button title="删除图片（⌘Z 可撤销）" aria-label="删除图片" onMouseDown={e=>e.preventDefault()} onClick={()=>{const s=selected();if(!s)return;view.dispatch(closeHistory(view.state.tr).delete(s.from,s.to).scrollIntoView());view.focus();}}><Trash2 size={16}/></button>
    <span className="image-tools-message" role="status">{message || (anchor.natural ? `${anchor.width} px` : '图片加载中')}</span>
  </div>, document.body);
}
