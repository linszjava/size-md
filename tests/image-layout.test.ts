// @vitest-environment jsdom
import { it, expect } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, NodeSelection } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';
import { history, undo } from '@milkdown/kit/prose/history';
import { layoutImages } from '../src/lib/image-layout';
import { imageColumns } from '../src/lib/image-size';
import { renderArticle } from '../src/lib/render';
const schema=new Schema({nodes:{doc:{content:'paragraph+'},paragraph:{content:'inline*',toDOM:()=>['p',0]},text:{group:'inline'},image:{inline:true,group:'inline',attrs:{src:{},title:{default:null}},toDOM:n=>['img',n.attrs]}}});
const img=(src:string)=>schema.nodes.image.create({src});
const p=(...content:any[])=>schema.nodes.paragraph.create(null,content);
function setup(blocks:any[]){return new EditorView(document.createElement('div'),{state:EditorState.create({schema,doc:schema.nodes.doc.create(null,blocks),selection:NodeSelection.create(schema.nodes.doc.create(null,blocks),1),plugins:[history()]})});}
it('combines adjacent images, splits back and supports undo without changing URLs',()=>{
 const view=setup([p(img('a')),p(img('b')),p(img('c'))]);
 expect(layoutImages(view,2)).toBeNull();expect(view.state.doc.childCount).toBe(2);
 expect(view.state.doc.firstChild!.child(2).attrs.src).toBe('b');
 expect(imageColumns(view.state.doc.firstChild!.firstChild!.attrs.title).columns).toBe(2);
 expect(layoutImages(view,1)).toBeNull();expect(view.state.doc.childCount).toBe(3);
 undo(view.state,view.dispatch);expect(view.state.doc.childCount).toBe(2);view.destroy();
});
it('does not consume captions or intervening body text',()=>{
 const view=setup([p(img('a')),p(schema.text('说明')),p(img('b'))]);const before=view.state.doc.toJSON();
 expect(layoutImages(view,2)).toContain('相邻图片');expect(view.state.doc.toJSON()).toEqual(before);view.destroy();
});
it('exports two images on one line at proportional widths',()=>{
 const root=document.createElement('div');root.innerHTML=renderArticle('![A](https://example.com/a.png "{size-md-columns=2}") ![B](https://example.com/b.png "{size-md-columns=2}")','gothic',16).html;
 const imgs=root.querySelectorAll('img');expect(imgs.length).toBe(2);expect(imgs[0].parentElement).toBe(imgs[1].parentElement);
 for(const img of imgs){expect(img.style.width).toBe('48%');expect(img.style.display).toBe('inline-block');expect(img.title).toBe('');}
});
