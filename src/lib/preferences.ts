export const preferencesKey = 'size-md-preferences-v1';
export const defaultPreferences = {
  themeDirectory: '~/Library/Application Support/Size MD/themes',
  saveDirectory: '~/Documents',
  pdfPaper: 'A4' as 'A4' | 'A5' | 'Letter',
  pdfMargin: 20,
  pdfHeadingBreak: false,
  headingStyle: 'atx' as 'atx' | 'setext',
  bullet: '-' as '-' | '*' | '+',
  orderedStyle: 'increment' as 'increment' | 'fixed',
  autoLink: true,
  subscript: false,
  superscript: false,
  highlight: false,
  smartPunctuation: false,
  smartQuotes: false,
  spellcheck: false,
  selectionToolbar: false,
  articleToolbar: true,
  lineNumbers: true,
  codeHighlight: true,
  startWithPreview: false,
};
export type Preferences = typeof defaultPreferences;
export function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(preferencesKey) || '{}');
    const result = { ...defaultPreferences };
    for (const key of Object.keys(result) as (keyof Preferences)[]) {
      if (typeof result[key] === 'boolean' && typeof stored[key] === 'boolean') Object.assign(result, { [key]: stored[key] });
    }
    if(typeof stored.themeDirectory === 'string' && /^(\/|~\/)/.test(stored.themeDirectory)) result.themeDirectory=stored.themeDirectory;
    if(typeof stored.saveDirectory === 'string' && /^(\/|~\/)/.test(stored.saveDirectory)) result.saveDirectory=stored.saveDirectory;
    if(['A4','A5','Letter'].includes(stored.pdfPaper)) result.pdfPaper=stored.pdfPaper;
    if(Number.isFinite(stored.pdfMargin)&&stored.pdfMargin>=0&&stored.pdfMargin<=40) result.pdfMargin=stored.pdfMargin;
    if (['atx', 'setext'].includes(stored.headingStyle)) result.headingStyle = stored.headingStyle;
    if (['-', '*', '+'].includes(stored.bullet)) result.bullet = stored.bullet;
    if (['increment', 'fixed'].includes(stored.orderedStyle)) result.orderedStyle = stored.orderedStyle;
    return result;
  } catch { return { ...defaultPreferences }; }
}
