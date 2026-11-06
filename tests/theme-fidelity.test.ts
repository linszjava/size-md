import {it,expect} from 'vitest';
import {importTyporaTheme,themeRules,rulesCss} from '../src/lib/themes';
it('preserves imported heading layout, resolved gradients and decorative backgrounds without Gothic overrides',()=>{
 const {rules}=importTyporaTheme(`
 html{font-family:"Test Font"}
 #write{position:relative;z-index:0;max-width:950px}
 #write h2{color:var(--heading-color);background:var(--heading-bg);width:fit-content}
 #write::before{content:"";position:absolute;inset:0;pointer-events:none;mask-image:var(--pattern)}
 :root{--heading-color: #fff;--heading-bg: linear-gradient(to right, #85c1e9, #3498db);--pattern: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0L20 20'/%3E%3C/svg%3E");}
 `);
 expect(rules.h2['background-image']).toContain('linear-gradient');
 expect(rules.h2.color).toBe('#fff');expect(rules.h2.width).toBe('fit-content');
 expect(rules['section::before']['mask-image']).toContain('data:image/svg+xml');
 const applied=themeRules('gothic',16,rules);
 expect(applied.h2['text-align']).toBeUndefined();
 expect(applied.section['font-family']).toBe('"Test Font"');
 expect(rulesCss(applied)).toContain('.article-content::before{');
});
