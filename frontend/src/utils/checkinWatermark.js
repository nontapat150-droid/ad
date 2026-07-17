/** Site brand palette (matches CheckinPage / Sidebar) */
export const BRAND = {
  dark: '#1F2937',
  darkMid: '#374151',
  lime: '#A3E635',
  limeDark: '#84CC16',
  textMuted: '#9CA3AF',
  textLight: '#F9FAFB',
  border: '#E5E7EB',
};

/**
 * Load an image for canvas drawing (with CORS when possible).
 */
export function loadImageForCanvas(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Wrap text to fit max width on canvas.
 */
export function wrapCanvasText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundedTopRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw check-in watermark: logo, site name, GPS, detailed address.
 * Styled to match site branding (#1F2937 + #A3E635).
 */
export function drawCheckinWatermark(ctx, {
  width: w,
  height: h,
  lat,
  lng,
  address = '',
  siteName = 'Bount',
  logoImg = null,
  mirrorFix = false,
}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const latStr = Number.isFinite(lat) ? Number(lat).toFixed(6) : '0.000000';
  const lngStr = Number.isFinite(lng) ? Number(lng).toFixed(6) : '0.000000';

  const pad = Math.round(h * 0.016);
  const titleFont = Math.round(h * 0.027);
  const bodyFont = Math.round(h * 0.021);
  const smallFont = Math.round(h * 0.017);
  const logoSize = Math.round(h * 0.052);
  const cornerR = Math.round(h * 0.012);

  ctx.save();
  if (mirrorFix) {
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);
  }

  const textMaxW = w - pad * 2 - (logoImg ? logoSize + pad : 0);
  ctx.font = `${smallFont}px 'Sarabun', 'Tahoma', sans-serif`;
  const addrLines = wrapCanvasText(ctx, address || 'ไม่พบข้อมูลที่อยู่', textMaxW);
  const addrLineCount = Math.min(addrLines.length, 3);

  const headerRowH = Math.max(logoSize, titleFont + 6);
  const contentH =
    pad + 4 + // accent line
    headerRowH +
    bodyFont + 10 +
    smallFont * addrLineCount +
    (addrLineCount > 1 ? (addrLineCount - 1) * 4 : 0) +
    pad;
  const barH = Math.max(Math.round(h * 0.17), contentH);
  const barY = h - barH;

  // Brand bar background
  const grad = ctx.createLinearGradient(0, barY, 0, h);
  grad.addColorStop(0, 'rgba(31,41,55,0.92)');
  grad.addColorStop(1, 'rgba(17,24,39,0.97)');
  drawRoundedTopRect(ctx, 0, barY, w, barH, cornerR);
  ctx.fillStyle = grad;
  ctx.fill();

  // Lime accent stripe (matches site buttons / modal headers)
  ctx.fillStyle = BRAND.lime;
  ctx.fillRect(0, barY, w, Math.max(3, Math.round(h * 0.004)));

  let textX = pad;
  const textTop = barY + pad + 4;

  // Logo box
  if (logoImg) {
    const lx = pad;
    const ly = textTop;
    const r = Math.round(logoSize * 0.2);
    ctx.save();
    drawRoundedTopRect(ctx, lx, ly, logoSize, logoSize, r);
    ctx.clip();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(lx, ly, logoSize, logoSize);
    ctx.drawImage(logoImg, lx + 2, ly + 2, logoSize - 4, logoSize - 4);
    ctx.restore();
    // Border ring
    ctx.strokeStyle = 'rgba(229,231,235,0.8)';
    ctx.lineWidth = 1.5;
    drawRoundedTopRect(ctx, lx, ly, logoSize, logoSize, r);
    ctx.stroke();
    textX = pad + logoSize + pad;
  }

  // Site name
  ctx.font = `900 ${titleFont}px 'Sarabun', 'Tahoma', sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(siteName, textX, textTop + titleFont);

  // Date/time badge (right)
  ctx.font = `600 ${smallFont}px 'Sarabun', 'Tahoma', sans-serif`;
  const dt = `${dateStr}  ${timeStr}`;
  const dtW = ctx.measureText(dt).width + pad * 1.2;
  const dtH = smallFont + pad * 0.6;
  const dtX = w - pad - dtW;
  const dtY = textTop + titleFont - dtH + 2;
  ctx.fillStyle = 'rgba(55,65,81,0.85)';
  drawRoundedTopRect(ctx, dtX, dtY, dtW, dtH, Math.round(dtH * 0.35));
  ctx.fill();
  ctx.fillStyle = BRAND.textMuted;
  ctx.fillText(dt, dtX + pad * 0.6, dtY + dtH - pad * 0.35);

  // GPS row
  const coordsY = textTop + headerRowH + bodyFont;
  ctx.font = `700 ${smallFont}px 'Sarabun', 'Tahoma', sans-serif`;
  const gpsLabel = 'GPS';
  const gpsLabelW = ctx.measureText(gpsLabel).width + pad;
  const gpsLabelH = smallFont + pad * 0.5;
  ctx.fillStyle = BRAND.lime;
  drawRoundedTopRect(ctx, textX, coordsY - gpsLabelH + 2, gpsLabelW, gpsLabelH, Math.round(gpsLabelH * 0.3));
  ctx.fill();
  ctx.fillStyle = BRAND.dark;
  ctx.fillText(gpsLabel, textX + pad * 0.4, coordsY - pad * 0.15);

  ctx.font = `600 ${bodyFont}px 'Courier New', monospace`;
  ctx.fillStyle = BRAND.lime;
  ctx.fillText(`${latStr}, ${lngStr}`, textX + gpsLabelW + pad * 0.5, coordsY);

  // Address
  ctx.font = `${smallFont}px 'Sarabun', 'Tahoma', sans-serif`;
  ctx.fillStyle = 'rgba(249,250,251,0.95)';
  let ay = coordsY + smallFont + 10;
  for (let i = 0; i < addrLineCount; i++) {
    ctx.fillText(addrLines[i], textX, ay);
    ay += smallFont + 4;
  }

  ctx.restore();
}
