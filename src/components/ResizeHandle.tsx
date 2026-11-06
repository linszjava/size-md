import { useRef, useState } from 'react';

type Props = { label: string; value: number; min: number; max: number; reverse?: boolean; onChange: (value: number) => void; onReset: () => void };
export default function ResizeHandle({ label, value, min, max, reverse = false, onChange, onReset }: Props) {
  const start = useRef({ x: 0, value: 0 });
  const [dragging, setDragging] = useState(false);
  const clamp = (next: number) => Math.round(Math.max(min, Math.min(max, next)));
  return <div className={`resize-handle ${dragging ? 'dragging' : ''}`} role="separator" tabIndex={0}
    aria-label={label} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
    title="左右拖动调整宽度，双击恢复默认" onDoubleClick={onReset}
    onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); start.current = { x: e.clientX, value }; e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); }}
    onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) onChange(clamp(start.current.value + (e.clientX - start.current.x) * (reverse ? -1 : 1))); }}
    onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setDragging(false); }}
    onLostPointerCapture={() => setDragging(false)} onPointerCancel={() => setDragging(false)}
    onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); onChange(clamp(value + (e.key === 'ArrowRight' ? 10 : -10) * (reverse ? -1 : 1))); } else if (e.key === 'Home') { e.preventDefault(); onChange(min); } else if (e.key === 'End') { e.preventDefault(); onChange(max); } }} />;
}
