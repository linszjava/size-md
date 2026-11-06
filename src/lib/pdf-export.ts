import { invoke } from '@tauri-apps/api/core';
import { desktop } from './platform';
import { renderArticle } from './render';
import type { Preferences } from './preferences';
import type { Rules, ThemeId } from './themes';
let exporting=false;
export async function exportPdf(markdown:string,name:string,theme:ThemeId,fontSize:number,custom:Rules,preferences:Preferences) {
  if(exporting)throw new Error('PDF 正在导出，请稍候。');
  exporting=true;
  let root:HTMLElement|null=null,style:HTMLStyleElement|null=null;
  try {
    let path:string|null=null;
    if(desktop){const {save}=await import('@tauri-apps/plugin-dialog');const {join}=await import('@tauri-apps/api/path');const dir=await invoke<string>('prepare_document_directory',{path:preferences.saveDirectory});path=await save({defaultPath:await join(dir,name.replace(/[\\/:*?"<>|]/g,'-')+'.pdf'),filters:[{name:'PDF',extensions:['pdf']}]});if(!path)return false;}
    root=document.createElement('div');root.id='pdf-export-root';root.innerHTML=renderArticle(markdown,theme,fontSize,custom,preferences,true).html;
    for(const img of root.querySelectorAll('img')){
      const url=img.getAttribute('src')||'';
      if(url.startsWith('file://')){if(!desktop)throw new Error('本地图片 PDF 导出请使用桌面版。');const bytes=await invoke<number[]>('read_local_image',{path:decodeURIComponent(new URL(url).pathname)});const blob=new Blob([new Uint8Array(bytes)]);img.src=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});}
    }
    style=document.createElement('style');style.textContent=`#pdf-export-root{display:none}@media print{@page{size:${preferences.pdfPaper};margin:${preferences.pdfMargin}mm}html,body{height:auto!important;overflow:visible!important;background:white!important}body>*:not(#pdf-export-root){display:none!important}#pdf-export-root{display:block!important;color-adjust:exact;-webkit-print-color-adjust:exact}#pdf-export-root section{max-width:none!important}#pdf-export-root img{max-width:100%!important;break-inside:avoid}#pdf-export-root pre{white-space:pre-wrap!important;break-inside:avoid}#pdf-export-root table{width:100%;table-layout:fixed}#pdf-export-root tr{break-inside:avoid}#pdf-export-root h1,#pdf-export-root h2,#pdf-export-root h3{break-after:avoid}${preferences.pdfHeadingBreak?'#pdf-export-root h1:not(:first-child){break-before:page}':''}}`;
    document.head.append(style);document.body.append(root);
    await document.fonts.ready;
    await Promise.all(Array.from(root.querySelectorAll('img')).map(img=>Promise.race([img.decode(),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('图片加载超时，请检查网络后重试。')),15000))])));
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    if(desktop)await invoke('export_pdf',{path,paper:preferences.pdfPaper,margin:preferences.pdfMargin});else window.print();
    return true;
  } finally {root?.remove();style?.remove();exporting=false;}
}
