import { diffChars } from 'diff';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Transform } from '@milkdown/kit/prose/transform';
import { TextSelection } from '@milkdown/kit/prose/state';

export type SelectionOffsets = { anchor: number; head: number };
type Serialize = (doc: ProseNode) => string;

// Align the serializer's spelling (list markers, escapes, table padding, etc.)
// with the untouched source. Equal spans retain exact UTF-16 cursor offsets.
export function mapTextOffset(from: string, to: string, position: number): number {
  if (from === to) return Math.min(position, to.length);
  let oldOffset = 0, newOffset = 0;
  for (const part of diffChars(from, to)) {
    const length = part.value.length;
    if (part.added) { newOffset += length; continue; }
    if (position < oldOffset + length) return newOffset + (part.removed ? 0 : position - oldOffset);
    oldOffset += length;
    if (!part.removed) newOffset += length;
  }
  return newOffset;
}

function cursorProbe(doc: ProseNode, serialize: Serialize, source: string, position: number) {
  const resolved = doc.resolve(Math.max(0, Math.min(position, doc.content.size)));
  const point = resolved.parent.inlineContent ? resolved : TextSelection.near(resolved).$head;
  const marker = 'SIZEMDCURSOR' + crypto.randomUUID().replaceAll('-', '');
  // Serialize an immutable copy; never dispatch the marker or rewrite the source.
  // The editor's own serializer understands color, extensions and blank HTML nodes.
  const copy = new Transform(doc).insert(point.pos, doc.type.schema.text(marker, point.marks())).doc;
  const marked = serialize(copy);
  const offset = marked.indexOf(marker);
  if (offset < 0) throw new Error('无法定位当前光标，请重试切换。');
  const unmarked = marked.slice(0, offset) + marked.slice(offset + marker.length);
  return mapTextOffset(unmarked, source, offset);
}

export function sourceSelection(doc: ProseNode, serialize: Serialize, source: string, anchor: number, head: number): SelectionOffsets {
  const mappedAnchor = cursorProbe(doc, serialize, source, anchor);
  return { anchor: mappedAnchor, head: anchor === head ? mappedAnchor : cursorProbe(doc, serialize, source, head) };
}

export function editorSelection(doc: ProseNode, serialize: Serialize, source: string, selection: SelectionOffsets): SelectionOffsets {
  const normalized = serialize(doc);
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    for (let offset = 0; offset <= node.content.size; offset++) positions.push(pos + 1 + offset);
    return false;
  });
  if (!positions.length) return { anchor: 0, head: 0 };
  const cache = new Map<number, number>();
  const probe = (index: number) => {
    if (!cache.has(index)) cache.set(index, cursorProbe(doc, serialize, normalized, positions[index]));
    return cache.get(index)!;
  };
  const locate = (offset: number) => {
    const target = mapTextOffset(source, normalized, offset);
    let low = 0, high = positions.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (probe(middle) < target) low = middle + 1;
      else high = middle;
    }
    if (low > 0 && Math.abs(probe(low - 1) - target) < Math.abs(probe(low) - target)) low--;
    return positions[low];
  };
  const anchor = locate(selection.anchor);
  return { anchor, head: selection.anchor === selection.head ? anchor : locate(selection.head) };
}
