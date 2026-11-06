import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
const optionText = (node: ReactNode): string => Array.isArray(node) ? node.map(optionText).join('') : String(node ?? '');
type Props = { label: string; value: string | number; onValueChange: (value: string) => void; children: ReactNode; disabled?: boolean };
export default function ChoiceSelect({ label, value, onValueChange, children, disabled }: Props) {
  const options = Children.toArray(children).filter(isValidElement<{ value?: string | number; children: ReactNode }>).map(child => ({ value: String(child.props.value ?? child.props.children), label: optionText(child.props.children) }));
  const selected = Math.max(0, options.findIndex(option => option.value === String(value)));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  function place() {
    const rect = trigger.current!.getBoundingClientRect();
    const height = options.length * 30 + 10;
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 180) - 8)), top: rect.bottom + height + 6 <= window.innerHeight ? rect.bottom + 5 : Math.max(8, rect.top - height - 5), width: Math.max(rect.width, 180) });
  }
  function show() {
    if (disabled || trigger.current?.matches(':disabled')) return;
    place(); setActive(selected); setOpen(true);
  }
  function choose(index: number) { onValueChange(options[index].value); setOpen(false); trigger.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    const close = () => setOpen(false);
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) place(); };
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', close); document.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); document.removeEventListener('scroll', scroll, true); };
  }, [open]);
  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (!open) { show(); return; }
      if (event.key === 'Enter' || event.key === ' ') choose(active);
      else setActive(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key.length === 1 && open) {
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (index >= 0) setActive(index);
    }
  }
  return <span className="choice-select"><button ref={trigger} type="button" className="choice-trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-controls={open ? id : undefined} aria-expanded={open} aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled} onKeyDown={keyDown} onBlur={() => setOpen(false)} onClick={() => open ? setOpen(false) : show()}><span>{options[selected]?.label}</span><ChevronDown size={13}/></button>{open && createPortal(<div ref={menu} id={id} role="listbox" aria-label={label} className="choice-menu" style={position} onMouseDown={e => e.preventDefault()}>{options.map((option, index) => <div key={option.value} role="option" id={`${id}-${index}`} aria-selected={index === selected} className={index === active ? 'active' : ''} onPointerMove={() => setActive(index)} onClick={event => { event.stopPropagation(); choose(index); }}><Check size={13} style={{ visibility: index === selected ? 'visible' : 'hidden' }}/><span>{option.label}</span></div>)}</div>, document.body)}</span>;
}
