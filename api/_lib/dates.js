// Utilitas zona waktu WIB (UTC+7).
// Prinsip PRD: tanggal memakai DATE string 'YYYY-MM-DD' di zona WIB,
// jangan pakai jam server (UTC) mentah-mentah.

const WIB_OFFSET_MIN = 7 * 60; // UTC+7

export function wibNow() {
  // Date object "waktu nyata", dipakai hanya untuk timestamp penyimpanan.
  return new Date();
}

/** Tanggal hari ini di WIB sebagai 'YYYY-MM-DD' */
export function todayWIB(now = new Date()) {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Jam WIB sekarang, format 'HH:MM' */
export function timeWIB(now = new Date()) {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(11, 16);
}

/** Parse 'YYYY-MM-DD' → Date (UTC tengah hari); validasi ketat. */
export function parseDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  // cek round-trip: tolak 2026-02-31 dsb.
  if (d.toISOString().slice(0, 10) !== str) return null;
  return d;
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(dateStr, n) {
  const d = parseDate(dateStr);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

/** Senin pada minggu dari dateStr (ISO: minggu mulai Senin) */
export function weekStart(dateStr) {
  const d = parseDate(dateStr);
  const dow = d.getUTCDay(); // 0=Minggu … 6=Sabtu
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diff);
}

/** Awal bulan dari dateStr → 'YYYY-MM-01' */
export function monthStart(dateStr) {
  return dateStr.slice(0, 8) + '01';
}

/** Array tanggal dateStr..endInclusive */
export function dateRange(startStr, endStr) {
  const out = [];
  let cur = startStr;
  while (cur <= endStr) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/** '2026-09-18' → {label:'18 Sep 2026', hari:'Kamis'} */
export function formatDateID(dateStr, withDay = false) {
  const d = parseDate(dateStr);
  const s = `${d.getUTCDate()} ${BULAN[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
  if (!withDay) return s;
  return { label: s, hari: HARI[d.getUTCDay()] };
}

export function monthLabelID(ymStr) {
  // ymStr: 'YYYY-MM'
  const [y, m] = ymStr.split('-').map(Number);
  return `${BULAN[m - 1]} ${y}`;
}
