import { withoutAlignmentWrappers } from './text-alignment';
import { withoutColorSpans } from './text-colors';
// Keep syntax outside our editing schema in the original source instead of silently rewriting it.
export function requiresSourceMode(markdown: string): boolean {
  const outsideCode = markdown.replace(/^ {0,3}(`{3,}|~{3,})([^\n]*)\n[\s\S]*?^ {0,3}\1[ \t]*$/gm, (block, _fence, language) => /^(mermaid|math)\b/.test(language.trim()) ? block : '');
  const withoutBlankLines = withoutColorSpans(withoutAlignmentWrappers(outsideCode)).replace(/<br\s*\/?\s*>/gi, '');
  return /^---\s*\n/.test(markdown) || /(^|\n)\s*<(?:[a-zA-Z!]|\/)/.test(withoutBlankLines) || /\$\$|```\s*(?:mermaid|math)\b|\[\^[^\]]+\]/.test(outsideCode);
}
