import { it, expect, vi } from 'vitest';
const invoke=vi.hoisted(()=>vi.fn().mockResolvedValue('https://img.example.com/test.png'));
vi.mock('@tauri-apps/api/core',()=>({isTauri:()=>true,invoke}));
import { uploadImage, initialStorage } from '../src/lib/platform';
const file={type:'image/png',size:3,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer} as File;
it('routes iPic uploads without requiring OSS/COS credentials or local storage',async()=>{
 invoke.mockClear();
 await expect(uploadImage(file,{...initialStorage,provider:'ipic'})).resolves.toBe('https://img.example.com/test.png');
 expect(invoke).toHaveBeenCalledExactlyOnceWith('upload_ipic',{data:[1,2,3]});
});
it('validates image type/size before sending bytes and propagates iPic errors',async()=>{
 invoke.mockClear();
 await expect(uploadImage({...file,size:16*1024*1024},{...initialStorage,provider:'ipic'})).rejects.toThrow('15 MB');
 expect(invoke).not.toHaveBeenCalled();
 invoke.mockRejectedValueOnce(new Error('未安装 iPic'));
 await expect(uploadImage(file,{...initialStorage,provider:'ipic'})).rejects.toThrow('未安装 iPic');
});
