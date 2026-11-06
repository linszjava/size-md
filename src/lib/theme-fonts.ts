import { invoke } from '@tauri-apps/api/core';
import type { Rules } from './themes';

// Buffer-backed FontFace avoids WKWebView's custom-scheme font loader.
export function mountThemeFonts(rules: Rules, onError?: (message: string) => void): () => void {
  let cancelled = false;
  const mounted: FontFace[] = [];
  for (const [selector, face] of Object.entries(rules)) {
    if (!selector.startsWith('@font-face')) continue;
    const url = face.src?.match(/^url\(["']?(asset:\/\/localhost[^)"']+)["']?\)/)?.[1];
    if (!url || !face['font-family']) continue;
    void (async () => {
      try {
        const bytes = await invoke<ArrayBuffer | number[]>('read_theme_font', { path: decodeURIComponent(new URL(url).pathname) });
        if (cancelled) return;
        const font = new FontFace(face['font-family'].replace(/^(["'])(.*)\1$/, '$2'), Array.isArray(bytes) ? new Uint8Array(bytes) : bytes, {
          weight: face['font-weight'] || 'normal', style: face['font-style'] || 'normal',
        });
        await font.load();
        if (cancelled) return;
        document.fonts.add(font);
        mounted.push(font);
      } catch (error) {
        if (!cancelled) onError?.(`主题字体 ${face['font-family']} 加载失败：${String(error)}`);
      }
    })();
  }
  return () => { cancelled = true; mounted.forEach(font => document.fonts.delete(font)); };
}
