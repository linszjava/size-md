import {afterEach,expect,it,vi} from 'vitest';
import {mountThemeFonts} from '../src/lib/theme-fonts';
import {invoke} from '@tauri-apps/api/core';
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('loads authorized theme font bytes and removes mounted faces when switching themes',async()=>{
 const bytes=[0,1,0,0];
 vi.mocked(invoke).mockResolvedValue(bytes);
 const fonts=new Set();
 vi.stubGlobal('document',{fonts});
 class Face {constructor(public family:string,public data:ArrayBuffer){} async load(){return this;}}
 vi.stubGlobal('FontFace',Face);
 const dispose=mountThemeFonts({'@font-face 0':{'font-family':'"Test Font"',src:'url(asset://localhost/themes/my%20font.ttf)'}});
 await vi.waitFor(()=>expect(fonts.size).toBe(1));
 expect(invoke).toHaveBeenCalledWith('read_theme_font',{path:'/themes/my font.ttf'});
 expect([...fonts][0]).toMatchObject({family:"Test Font",data:new Uint8Array(bytes)});
 dispose();expect(fonts.size).toBe(0);
});
it('does not mount a font that finishes after switching away from its theme',async()=>{
 let finish!:(data:ArrayBuffer)=>void;
 vi.mocked(invoke).mockImplementation(()=>new Promise(resolve=>{finish=resolve as typeof finish;}));
 const fonts=new Set();vi.stubGlobal('document',{fonts});
 const dispose=mountThemeFonts({'@font-face 0':{'font-family':'Test',src:'url(asset://localhost/themes/test.ttf)'}});
 dispose();finish(new ArrayBuffer(4));await Promise.resolve();await Promise.resolve();
 expect(fonts.size).toBe(0);
});
