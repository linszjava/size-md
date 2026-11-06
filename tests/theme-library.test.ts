import {it,expect} from 'vitest';
import {synchronizeThemes} from '../src/lib/theme-library';
import {importTyporaTheme,rulesCss} from '../src/lib/themes';
it('reconciles additions, edits and deletions without changing stable ids',()=>{
 const original=synchronizeThemes([],[{name:'package/a.css',css:'h2{color:red}'}]);
 expect(synchronizeThemes(original,[{name:'package/a.css',css:'h2{color:red}'}])).toBe(original);
 const next=synchronizeThemes(original,[{name:'package/a.css',css:'h2{color:blue}'}]);
 expect(next[0].id).toBe(original[0].id);expect(next[0].rules.h2.color).toBe('blue');
 expect(synchronizeThemes(next,[])).toEqual([]);
});
it('retains package fonts and safe gradients',()=>{
 const {rules}=importTyporaTheme('@font-face{font-family:Test;src:url(asset://localhost/tmp/test.woff2)} h2{background:linear-gradient(red,blue);font-family:Test}');
 expect(rulesCss(rules)).toContain('@font-face{');expect(rules.h2['background-image']).toBe('linear-gradient(red,blue)');
});
