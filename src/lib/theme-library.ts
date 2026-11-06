import type { Rules } from './themes';
export type ImportedTheme = { id: string; name: string; rules: Rules };
export const themeLibraryKey = 'size-md-theme-library-v1';
export function readThemeLibrary(drafts: { themeName?: string; custom: Rules }[]): ImportedTheme[] {
  let library: ImportedTheme[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(themeLibraryKey) ?? '[]');
    if (Array.isArray(parsed)) library = parsed.filter(t => typeof t.id === 'string' && typeof t.name === 'string' && t.rules && typeof t.rules === 'object');
  } catch { /* Recover imported themes from drafts. */ }
  for (const d of drafts) {
    if (d.themeName && !library.some(t => t.name === d.themeName)) library.push({ id: `imported-${crypto.randomUUID()}`, name: d.themeName, rules: d.custom });
  }
  return library;
}

export function synchronizeThemes(previous:ImportedTheme[], files:{name:string;css:string}[]):ImportedTheme[]{
 const next=files.flatMap(file=>{
  const old=previous.find(t=>t.name===file.name);
  try {const {rules}=importTyporaTheme(file.css);if(Object.values(rules).some(v=>Object.keys(v).length))return [{id:old?.id??'imported-'+encodeURIComponent(file.name),name:file.name,rules}];}catch{/* Keep the last valid version during partial writes. */}
  return old?[old]:[];
 });
 return JSON.stringify(previous)===JSON.stringify(next)?previous:next;
}
import { importTyporaTheme } from './themes';

// Keep stored paths intact; only shorten labels shown to the user.
export function themeDisplayName(name: string): string {
  return (name.split(/[\\/]/).pop() || name).replace(/\.css$/i, "");
}
