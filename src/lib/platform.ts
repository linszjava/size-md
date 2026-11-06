import { isTauri, invoke } from '@tauri-apps/api/core';
export const desktop = isTauri();

export type StorageConfig = { provider: 'local' | 'oss' | 'cos' | 'ipic'; localDir: string; bucket: string; region: string; publicUrl: string; prefix: string };
export const initialStorage: StorageConfig = { provider: 'local', localDir: '~/Pictures/Size MD', bucket: '', region: 'cn-hangzhou', publicUrl: '', prefix: 'size-md' };
export async function saveCredentials(accessKey: string, secretKey: string) {
  if (!desktop) throw new Error('请在 Mac 桌面版中配置密钥，密钥会存入系统钥匙串。');
  await invoke('save_credentials', { accessKey, secretKey });
}
export async function uploadImage(file: File, config: StorageConfig): Promise<string> {
  if (!desktop) throw new Error('图片直传需要 Mac 桌面版。此预览不会保存图片到本地，请使用已有 HTTPS 图片链接。');
  if (['oss', 'cos'].includes(config.provider) && (!config.bucket || !config.publicUrl)) throw new Error('请先在图片设置中填写 Bucket、区域和访问域名。');
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('支持 PNG、JPEG、WebP、GIF 图片。');
  if (file.size > 15 * 1024 * 1024) throw new Error('单张图片请控制在 15 MB 以内。');
  if (config.provider === 'ipic') return invoke<string>('upload_ipic', {data: Array.from(new Uint8Array(await file.arrayBuffer()))});
  if (config.provider === 'local') {
    const path = await invoke<string>('save_local_image', { data: Array.from(new Uint8Array(await file.arrayBuffer())), path: config.localDir });
    return 'file://' + path.split('/').map(encodeURIComponent).join('/');
  }
  return invoke<string>('upload_image', { data: Array.from(new Uint8Array(await file.arrayBuffer())), mime: file.type, config });
}
export async function copyArticle(html: string, plain: string) {
  if (desktop) {
    const { writeHtml } = await import('@tauri-apps/plugin-clipboard-manager');
    await writeHtml(html, plain);
  } else {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
  }
}
export async function saveMarkdown(content: string, name: string, path: string | null, directory = '~/Documents'): Promise<string | null> {
  if (desktop) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { join } = await import('@tauri-apps/api/path');
    const target = path ?? await save({ defaultPath: await join(await invoke<string>('prepare_document_directory', {path:directory}), name) });
    if (!target) return null;
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(target, content);
    return target;
  }
  download(content, name, 'text/markdown;charset=utf-8');
  return name;
}
export async function download(content: string, filename: string, type: string, directory = '~/Documents'): Promise<boolean> {
  if (desktop) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { join } = await import('@tauri-apps/api/path');
    const target = await save({ defaultPath: await join(await invoke<string>('prepare_document_directory', {path:directory}), filename) });
    if (!target) return false;
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(target, content);
    return true;
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
