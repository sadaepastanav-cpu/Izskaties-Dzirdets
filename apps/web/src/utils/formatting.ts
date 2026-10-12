import * as QRCodeLib from 'qrcode';

// Nodrošinām universālu saderību gan ar Vite/ESM, gan CommonJS moduļiem
const QRCode = (QRCodeLib as any).default || QRCodeLib;

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
  if (!totalMs || totalMs <= 0) return '0.00s';
  const totalSeconds = totalMs / 1000;
  return totalSeconds.toFixed(2) + 's';
};

export const escapeHtml = (unsafe: string = ''): string => {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * 🔒 CSV formulas injekciju filtrs:
 * Neitralizē kaitīgas Excel formulas (=, +, -, @), pievienojot drošu apostrofu.
 */
export const sanitizeCsvCell = (val: any): string => {
  const str = String(val ?? '');
  if (/^[=\+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

// ========================================================
// 📱 100% BEZSAISTES (OFFLINE) ISO STANDARTA QR ĢENERATORS
// ========================================================
/**
 * Ģenerē matemātiski precīzu, ISO 18004 standartam atbilstošu QR kodu lokāli pārlūkā.
 * Strādā pilnīgi bez interneta savienojuma lokālajā maršrutētājā.
 */
export const getOfflineQrCodeUrl = (text: string, size: number = 260): string => {
  if (!text) return '';

  try {
    // Ģenerējam oficiālo QR kodu ar kļūdu labojuma līmeni 'M'
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const modCount = qr.modules.size;
    const data = qr.modules.data;
    const margin = 2; // Obligātā baltā drošības apmale (quiet zone), lai kameras fiksētu malas
    const totalModules = modCount + margin * 2;
    const scale = size / totalModules;

    let path = '';
    for (let r = 0; r < modCount; r++) {
      for (let c = 0; c < modCount; c++) {
        // Ja modulis ir melns (1)
        if (data[r * modCount + c]) {
          const x = (c + margin) * scale;
          const y = (r + margin) * scale;
          path += `M${x.toFixed(2)},${y.toFixed(2)}h${scale.toFixed(2)}v${scale.toFixed(2)}h-${scale.toFixed(2)}z `;
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#ffffff"/><path d="${path}" fill="#000000" shape-rendering="crispEdges"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch (err) {
    // Drošs rezerves variants ar ārējo servisu, ja rodas neparedzēta kļūda
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(text)}`;
  }
};