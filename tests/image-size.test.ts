// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { imageSize, imageSizeTitle } from '../src/lib/image-size';
import { renderArticle } from '../src/lib/render';
it('keeps the URL and original title through Markdown save/reopen and reset', () => {
 const title=imageSizeTitle('原始说明',600);
 const source=`![图片](https://example.com/a.png "${title}")`;
 const processor=unified().use(remarkParse).use(remarkStringify);
 const saved=String(processor.processSync(source));
 const tree=processor.parse(saved) as any;
 const img=tree.children[0].children[0];
 expect(img.url).toBe('https://example.com/a.png');
 expect(imageSize(img.title)).toEqual({title:'原始说明',width:600});
 expect(imageSizeTitle(img.title,null)).toBe('原始说明');
 expect(imageSizeTitle(img.title,300)).toBe('原始说明 {size-md-width=300}');
});
it('exports dimensions after theme rules and hides metadata from the tooltip',()=>{
 const root=document.createElement('div');root.innerHTML=renderArticle('![图片](https://example.com/a.png "说明 {size-md-width=300}")','gothic',16,{img:{width:'100%'}}).html;
 const img=root.querySelector('img')!;
 expect(img.style.width).toBe('300px');expect(img.style.height).toBe('auto');expect(img.style.maxWidth).toBe('100%');expect(img.title).toBe('说明');expect(img.getAttribute('width')).toBe('300');
});
it('does not interpret invalid markers or code as image operations',()=>{
 expect(imageSize('说明 {size-md-width=0}').width).toBeNull();
 expect(imageSize('说明 {size-md-width=300} 其他').width).toBeNull();
 expect(()=>imageSizeTitle('',NaN)).toThrow();
 const root=document.createElement('div');root.innerHTML=renderArticle('`![图片](https://example.com/a.png "{size-md-width=300}")`','gothic',16).html;
 expect(root.querySelector('img')).toBeNull();
});
