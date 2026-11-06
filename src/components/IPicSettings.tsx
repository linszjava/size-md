import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { desktop, initialStorage, uploadImage } from '../lib/platform';

export function IPicSettings() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('先安装并打开 iPic，在 iPic 中选择上传图床，然后保存此配置。');
  const [url, setUrl] = useState('');
  async function check(upload: boolean) {
    setBusy(true); setUrl('');
    setMessage(upload ? '正在通过 iPic 上传测试图片…' : '正在检测 iPic…');
    try {
      const status = await invoke<string>('check_ipic');
      if (!upload) { setMessage(status); return; }
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 0, 320, 100);
      ctx.fillStyle = '#333'; ctx.font = '20px sans-serif'; ctx.fillText('Size MD · iPic upload test', 20, 56);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('测试图片生成失败。')), 'image/png'));
      const link = await uploadImage(new File([blob], 'size-md-ipic-test.png', {type:'image/png'}), {...initialStorage, provider:'ipic'});
      setUrl(link); setMessage(link.startsWith('https://') ? '上传成功，已收到图片网址。' : '上传成功，但返回的是 HTTP 地址。公众号导出需要 HTTPS，请在 iPic 中调整图床。');
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  }
  return <div>
    <p className="settings-note">粘贴、拖入或插入图片时，交给 iPic 上传，成功后自动插入网址。图床与账号在 iPic 中管理。</p>
    <div className="local-directory-row">
      <button type="button" className="button" disabled={busy || !desktop} onClick={() => void check(false)}>检测 iPic</button>
      <button type="button" className="button" disabled={busy || !desktop} onClick={() => void check(true)}>{busy ? '处理中…' : '验证图片上传'}</button>
      <button type="button" className="button" disabled={!desktop} onClick={() => void invoke('open_ipic_download').catch(e => setMessage(String(e)))}>下载 iPic…</button>
    </div>
    <p className="settings-note" role="status">{desktop ? message : 'iPic 集成仅支持 Mac 桌面版。'}</p>
    {url && <label>测试图片网址<input readOnly value={url} onFocus={e => e.target.select()}/></label>}
    <p className="settings-note">验证会上传一张 Size MD 测试图片，不会插入文章。请选择能返回 HTTPS 图片链接的图床。</p>
  </div>;
}
