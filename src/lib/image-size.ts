// Optional Markdown title metadata keeps ordinary image syntax and URLs intact.
export function imageSize(title: string | null | undefined) {
  const value = title || '';
  const match = value.match(/(?:^| )\{size-md-width=(\d{1,5})\}$/);
  const width = match ? Number(match[1]) : 0;
  return width >= 16 && width <= 16000
    ? { title: value.slice(0, match!.index), width }
    : { title: value, width: null };
}
export function imageColumns(title: string | null | undefined) {
  const value=title || '';
  const match=value.match(/(?:^| )\{size-md-columns=([23])\}$/);
  return {title:match ? value.slice(0,match.index) : value, columns:match ? Number(match[1]) : 1};
}
export function imageSizeTitle(title: string | null | undefined, width: number | null) {
  const original = imageSize(imageColumns(title).title).title;
  if (width === null) return original || null;
  if (!Number.isFinite(width) || width < 16 || width > 16000) throw new Error('图片宽度应在 16–16000 像素之间');
  return `${original ? original + ' ' : ''}{size-md-width=${Math.round(width)}}`;
}
export function imageColumnsTitle(title: string | null | undefined, columns: number) {
  const original = imageSizeTitle(title,null);
  if(columns===1)return original;
  if(columns!==2&&columns!==3)throw new Error('支持两图或三图并排');
  return `${original ? original+' ' : ''}{size-md-columns=${columns}}`;
}
export function applyImageSize(img: HTMLImageElement) {
  const row = imageColumns(img.getAttribute('title'));
  const size = imageSize(row.title);
  if (row.columns>1) {
    img.style.setProperty('width', row.columns===2 ? '48%' : '31%', 'important');
    img.style.setProperty('display','inline-block','important');
    img.style.setProperty('vertical-align','middle','important');
    img.style.setProperty('margin','4px 0.5%','important');
    img.style.setProperty('height','auto','important');
    img.style.setProperty('max-width','100%','important');
  } else if (size.width !== null) {
    img.style.setProperty('width', `${size.width}px`, 'important');
    img.style.setProperty('height', 'auto', 'important');
    img.style.setProperty('max-width', '100%', 'important');
    img.setAttribute('width', String(size.width));
  }
  if (size.title) img.title = size.title;
  else img.removeAttribute('title');
}
