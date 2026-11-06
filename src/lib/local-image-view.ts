import { applyImageSize } from './image-size';
import { NodeSelection } from '@milkdown/kit/prose/state';
import { invoke } from '@tauri-apps/api/core';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
export const localImageView = $prose(() => new Plugin({ props: { nodeViews: {
  image(node, view, getPos) {
    const img = document.createElement('img');
    img.alt = node.attrs.alt || ''; img.title = node.attrs.title || '';
    applyImageSize(img);
    const select = (event: MouseEvent) => {
      const pos = getPos(); if (pos === undefined) return;
      event.preventDefault(); view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos))); view.focus();
    };
    img.addEventListener('click', select); img.addEventListener('contextmenu', select);
    let disposed = false, objectUrl = '';
    const src = String(node.attrs.src);
    if (src.startsWith('file://')) {
      void invoke<number[]>('read_local_image', { path: decodeURIComponent(new URL(src).pathname) }).then(bytes => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)])); img.src = objectUrl;
      }).catch(() => { if (!disposed) { img.alt = `图片无法读取：${node.attrs.alt || '本地图片'}`; img.title = '请检查图片文件是否被移动或删除。'; } });
    } else img.src = src;
    return { dom: img, destroy() { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); } };
  }
} } }));
