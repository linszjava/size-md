// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderArticle } from '../src/lib/render';
import { defaultPreferences, readPreferences, preferencesKey } from '../src/lib/preferences';
it('keeps escaped markers, code and nested formatting literal', () => {
  const root = document.createElement('div');
  root.innerHTML = renderArticle('H~2~O X^2^ ==key==\n\n\\~literal\\~ `H~2~O` **==nested==**', 'gothic', 16, {}, { ...defaultPreferences, subscript: true, superscript: true, highlight: true }).html;
  expect(root.querySelectorAll('sub')).toHaveLength(1);
  expect(root.querySelectorAll('sup')).toHaveLength(1);
  expect(root.querySelectorAll('mark')).toHaveLength(1);
  expect(root.querySelector('strong')?.textContent).toBe('==nested==');
  expect(root.querySelector('code')?.textContent).toBe('H~2~O');
  expect(root.textContent).toContain('~literal~');
});
it('validates persisted preferences and ignores invalid values', () => {
  localStorage.setItem(preferencesKey, JSON.stringify({ bullet:'invalid', defaultFontSize:999, subscript:true }));
  expect(readPreferences()).toEqual({ ...defaultPreferences, subscript:true });
});
