// Format angka gaya Indonesia: 1500000 → "1,5jt", 500000 → "500rb",
// 50000 → "50rb" (compact), atau penuh "1.500.000".
// Dipakai bot & dashboard (dipercayai "compact number formatting" PRD v1.4).

export function formatRp(n, { compact = false } = {}) {
  const v = Number(n) || 0;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(Math.round(v));
  const full = sign + 'Rp' + abs.toLocaleString('id-ID');
  if (!compact) return full;
  if (abs >= 1_000_000_000) return sign + 'Rp' + trimZeros(abs / 1_000_000_000) + 'M';
  if (abs >= 1_000_000) return sign + 'Rp' + trimZeros(abs / 1_000_000) + 'jt';
  if (abs >= 1_000) return sign + 'Rp' + trimZeros(abs / 1_000) + 'rb';
  return full;
}

function trimZeros(x) {
  return Number(x.toFixed(1)).toString().replace('.', ',');
}

/** Parse input nominal user: "500000", "500.000", "1,5jt", "2jt", "50 rb" → integer */
export function parseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  let mult = 1;
  if (/^(rp)/.test(s)) s = s.slice(2);
  if (/jt$/.test(s)) { mult = 1_000_000; s = s.slice(0, -2); }
  else if (/m$/.test(s) && !/^[0-9.,]*$/.test(s.slice(0, -1))) { /* noop guard */ }
  if (/rb$/.test(s)) { mult = 1_000; s = s.slice(0, -2); }
  else if (/k$/.test(s)) { mult = 1_000; s = s.slice(0, -1); }
  if (!/^[0-9.,]+$/.test(s)) return null;
  // gaya Indonesia: titik = ribuan, koma = desimal
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes('.')) {
    // "1.500.000" vs "1.5" → kalau pola ribuan (3 digit per grup), buang titik
    s = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s.replace('.', ',');
    if (s.includes(',')) s = s.replace(',', '.');
  }
  const num = Number(s);
  if (!Number.isFinite(num) || num < 0) return null;
  const val = Math.round(num * mult);
  if (val > 10_000_000_000) return null; // sanity cap 10 miliar
  return val;
}

/** Laba bersih satu baris agregat harian */
export function netProfit(row) {
  return (row.income || 0) - (row.daily_expense || 0) - (row.weekly_expense || 0);
}

/** Shorthand format compact untuk label pendek di dashboard */
export function compactLabel(n) {
  return formatRp(n, { compact: true });
}
