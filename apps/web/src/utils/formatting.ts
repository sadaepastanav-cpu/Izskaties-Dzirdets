export const hexToRgba = (hex: string = '#000000', opacityPercent: number = 80): string => {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
};

export const getStudioFontSize = (fontSize?: number | string): string => {
  const scaleMultiplier = 1.35;
  if (typeof fontSize === 'number') return `${fontSize * scaleMultiplier * 9.6}px`;
  if (typeof fontSize === 'string') {
    const num = parseFloat(fontSize);
    if (!isNaN(num)) return `${num * scaleMultiplier * 9.6}px`;
  }
  return `${2.2 * scaleMultiplier * 9.6}px`;
};

export const getPresentationFontSize = (fontSize?: number | string): string => {
  const scaleMultiplier = 1.35;
  if (typeof fontSize === 'number') return `${fontSize * scaleMultiplier}vw`;
  if (typeof fontSize === 'string') {
    const num = parseFloat(fontSize);
    if (!isNaN(num)) return `${num * scaleMultiplier}vw`;
    return fontSize;
  }
  return `${2.2 * scaleMultiplier}vw`;
};

export const getOptionFontSize = (text: string = ''): string => {
  const len = text.trim().length;
  if (len <= 15) return 'clamp(1.1rem, 1.6vw, 2.0rem)';
  if (len <= 30) return 'clamp(0.95rem, 1.35vw, 1.7rem)';
  if (len <= 55) return 'clamp(0.8rem, 1.1vw, 1.4rem)';
  return 'clamp(0.7rem, 0.95vw, 1.2rem)';
};

export const formatThinkingTime = (totalMs: number = 0): string => {
  if (!totalMs || totalMs <= 0) return '0 sek un 000 ms';
  const ms = Math.floor(totalMs % 1000);
  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  const msStr = String(ms).padStart(3, '0');
  return minutes > 0 ? `${minutes} min ${seconds} sek un ${msStr} ms` : `${seconds} sek un ${msStr} ms`;
};

export const escapeHtml = (unsafe: string = ''): string => {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};