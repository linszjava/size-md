import { useEffect, useRef, useState } from 'react';
import { desktop } from '../lib/platform';
import { ChevronDown, FolderOpen } from 'lucide-react';

type Props = { id: string; onError: (message: string) => void; name: string; path?: string; onRename: (name: string) => Promise<void>; onSaveAs: (name?: string) => Promise<void> };
export default function DocumentTitle({ id, onError, name, path, onRename, onSaveAs }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setValue(name); setError(''); input.current?.focus(); input.current?.select(); } }, [open, name]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!pending && !root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open, pending]);
  const actions = useRef({ onRename, onSaveAs, onError }); actions.current = { onRename, onSaveAs, onError };
  useEffect(() => {
    if (!desktop) return;
    let disposed = false; let unlisten: (() => void) | undefined;
    void import('@tauri-apps/api/event').then(({ listen }) => listen<{id: string; name: string; action: string}>('document-title-result', event => {
      if (event.payload.id !== id) return;
      void (async () => { try { await actions.current.onRename(event.payload.name); if (event.payload.action === 'location') await actions.current.onSaveAs(event.payload.name); } catch (e) { actions.current.onError(String(e)); } })();
    })).then(fn => { if (disposed) fn(); else unlisten = fn; }).catch(e => actions.current.onError(String(e)));
    return () => { disposed = true; unlisten?.(); };
  }, [id]);
  async function showNative(button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect();
    try { const { invoke } = await import('@tauri-apps/api/core'); await invoke('show_document_title', { id, name, path: path ?? '', x: rect.x, y: rect.y, width: rect.width, height: rect.height }); } catch (e) { onError(String(e)); }
  }
  return <div className="document-title" ref={root}>
    <button className="document-title-button" aria-label="文件名称与位置" aria-expanded={open} onClick={e => { if (desktop) void showNative(e.currentTarget); else setOpen(v => !v); }} title={path ?? name}><span>{name}</span><ChevronDown size={13}/></button>
    {open && <form className="document-title-popover" role="dialog" aria-label="文件名称与位置" onKeyDown={e => { if (e.key === 'Escape' && !pending) { setOpen(false); e.stopPropagation(); } }} onSubmit={async e => { e.preventDefault(); setPending(true); setError(''); try { await onRename(value); setOpen(false); } catch (err) { setError(String(err)); } finally { setPending(false); } }}>
      <label className="document-name-row"><span>名称：</span><input ref={input} aria-label="文章名称" value={value} disabled={pending} onChange={e => setValue(e.target.value)} /></label>
      <div className="document-location-row"><span>位置：</span><button type="button" disabled={pending} title={path} onClick={async () => { setPending(true); try { await onSaveAs(); setOpen(false); } catch (err) { setError(String(err)); } finally { setPending(false); } }}><FolderOpen size={15}/><span>{path ? path.slice(0, path.lastIndexOf('/')) : '尚未保存为文件'}</span><ChevronDown size={13}/></button></div>
      {error && <p role="alert">{error}</p>}
      <div className="document-name-actions"><small>{path ? '更改位置将另存为新文件' : '草稿自动保存在本机'}</small><button type="submit" disabled={pending}>{pending ? '处理中…' : '完成'}</button></div>
    </form>}
  </div>;
}
