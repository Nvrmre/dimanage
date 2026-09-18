// ===== Bot engine (murni, bisa dites tanpa Telegram asli) =====
// Semua interaksi Telegram lewat sendFn yang di-inject, supaya unit test
// bisa mock. processUpdate(update, {db, send}) → reply text dikirim via send().

import { todayWIB, timeWIB, weekStart, addDays, formatDateID, monthStart, parseDate } from './dates.js';
import { formatRp, parseAmount, netProfit } from './format.js';
import { mergeByDate, dailySummary, monthlySummary, daysInMonth } from './summary.js';

const HELP_TEXT = [
  '📊 *Dimanage — Finance Tracker*',
  '',
  'Perintah:',
  '/lapor — catat pendapatan & pengeluaran hari ini',
  '/beli_bahan — catat belanja bahan baku',
  '/lihat_hari — ringkasan hari ini',
  '/lihat_bulan — ringkasan bulan ini',
  '/history — 7 hari terakhir',
  '/token — link akses web dashboard',
  '/help — bantuan'
].join('\n');

export function helpText() {
  return HELP_TEXT;
}

/* ---------------- users ---------------- */

export async function getUserByTelegramId(db, telegramId) {
  const { data } = await db.from('users').select('*').eq('telegram_id', telegramId).single();
  return data || null;
}

export async function ensureUser(db, telegramId, name) {
  const existing = await getUserByTelegramId(db, telegramId);
  if (existing) return existing;
  const { data, error } = await db
    .from('users')
    .insert({ telegram_id: telegramId, name: name || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setBotState(db, userId, state) {
  await db.from('users').update({ bot_state: state, updated_at: new Date().toISOString() }).eq('id', userId);
}

export function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------- data fetchers ---------------- */

export async function fetchDayData(db, userId, dateStr) {
  const [txRes, wxRes] = await Promise.all([
    db.from('transactions').select('*').eq('user_id', userId).eq('date', dateStr),
    db.from('weekly_expenses').select('*').eq('user_id', userId).eq('expense_date', dateStr)
  ]);
  if (txRes.error) throw txRes.error;
  if (wxRes.error) throw wxRes.error;
  return mergeByDate(txRes.data || [], wxRes.data || []);
}

export async function fetchRangeData(db, userId, startStr, endStr) {
  const [txRes, wxRes] = await Promise.all([
    db.from('transactions').select('*').eq('user_id', userId).gte('date', startStr).lte('date', endStr).order('date', { ascending: true }),
    db.from('weekly_expenses').select('*').eq('user_id', userId).gte('expense_date', startStr).lte('expense_date', endStr)
  ]);
  if (txRes.error) throw txRes.error;
  if (wxRes.error) throw wxRes.error;
  return mergeByDate(txRes.data || [], wxRes.data || []);
}

/* ---------------- /lapor flow ---------------- */

export async function startLapor(db, user) {
  await setBotState(db, user.id, { flow: 'lapor', step: 'income' });
  return '📝 Catat laporan hari ini.\n\nBerapa *pendapatan* hari ini? (angka saja, contoh: 500000)';
}

export async function handleLaporStep(db, user, state, text) {
  const today = todayWIB();

  if (state.step === 'income') {
    const amount = parseAmount(text);
    if (amount == null || amount <= 0) {
      return '⚠️ Pendapatan harus angka positif.\nContoh: 500000 — coba lagi:';
    }
    await setBotState(db, user.id, { flow: 'lapor', step: 'expense', income: amount });
    return `Pendapatan: *${formatRp(amount)}* ✅\n\nBerapa *pengeluaran* hari ini? (angka, atau ketik *tidak* jika tidak ada)`;
  }

  if (state.step === 'expense') {
    let expense = 0;
    const t = text.trim().toLowerCase();
    if (!['tidak', 'gak', 'ga', 'nggak', '0', '-'].includes(t)) {
      const amount = parseAmount(text);
      if (amount == null) {
        return '⚠️ Ketik angka (contoh: 50000) atau *tidak* jika tidak ada pengeluaran.';
      }
      expense = amount;
    }
    await setBotState(db, user.id, {
      flow: 'lapor', step: 'note', income: state.income, daily_expense: expense
    });
    if (expense === 0) {
      await finishLapor(db, user, state.income, 0, null);
      return confirmLapor(state.income, 0, null);
    }
    return 'Keterangan pengeluaran? (contoh: bensin — atau ketik *-* untuk lewati)';
  }

  if (state.step === 'note') {
    const note = text.trim() === '-' ? null : text.trim().slice(0, 200);
    await finishLapor(db, user, state.income, state.daily_expense, note);
    return confirmLapor(state.income, state.daily_expense, note);
  }

  return null;
}

async function finishLapor(db, user, income, dailyExpense, note) {
  const today = todayWIB();
  const payload = {
    user_id: user.id,
    date: today,
    income,
    daily_expense: dailyExpense,
    expense_note: note,
    updated_at: new Date().toISOString()
  };
  const { error } = await db.from('transactions').upsert(payload, { onConflict: 'user_id,date' });
  if (error) throw error;
  await setBotState(db, user.id, null);
}

function confirmLapor(income, expense, note) {
  const profit = income - expense;
  const lines = [
    '✅ *Laporan tersimpan!*',
    '',
    `Pendapatan : ${formatRp(income)}`,
    `Pengeluaran : ${formatRp(expense)}`,
    `*Laba bersih : ${formatRp(profit)}*`
  ];
  if (note) lines.push(`Ket: ${note}`);
  return lines.join('\n');
}

/* ---------------- /beli_bahan flow ---------------- */

export async function startBeliBahan(db, user) {
  await setBotState(db, user.id, { flow: 'beli_bahan', step: 'amount' });
  return '🛒 Catat belanja bahan baku.\n\nBerapa total belanja? (contoh: 2jt atau 2000000)';
}

export async function handleBeliBahanStep(db, user, state, text) {
  if (state.step === 'amount') {
    const amount = parseAmount(text);
    if (amount == null || amount <= 0) {
      return '⚠️ Nominal harus angka positif.\nContoh: 2jt atau 2000000 — coba lagi:';
    }
    await setBotState(db, user.id, { flow: 'beli_bahan', step: 'date', amount });
    return `Belanja: *${formatRp(amount)}* ✅\n\nBeban untuk tanggal berapa?\nKetik tanggal (YYYY-MM-DD) atau *hari ini*.`;
  }

  if (state.step === 'date') {
    const t = text.trim().toLowerCase();
    let expenseDate;
    if (['hari ini', 'today', '-'].includes(t)) {
      expenseDate = todayWIB();
    } else {
      const parsed = parseDate(text.trim());
      if (!parsed) {
        return '⚠️ Format tanggal salah. Gunakan YYYY-MM-DD (contoh: 2026-09-19) atau ketik *hari ini*.';
      }
      expenseDate = text.trim();
    }
    const week = weekStart(expenseDate);
    const payload = {
      user_id: user.id,
      week_start: week,
      expense_date: expenseDate,
      category: 'bahan_baku',
      amount: state.amount,
      description: 'Belanja bahan baku (via bot)',
      updated_at: new Date().toISOString()
    };
    const { error } = await db.from('weekly_expenses').upsert(payload, { onConflict: 'user_id,week_start,category' });
    if (error) throw error;
    await setBotState(db, user.id, null);
    return [
      '✅ *Belanja bahan baku tercatat!*',
      '',
      `Nominal : ${formatRp(state.amount, { compact: true })}`,
      `Tanggal beban : ${formatDateID(expenseDate, true).label} (${formatDateID(expenseDate, true).hari})`,
      '',
      'Nominal ini ikut mengurangi laba bersih pada tanggal tersebut.'
    ].join('\n');
  }

  return null;
}

/* ---------------- view commands ---------------- */

export async function lihatHari(db, user, dateStr) {
  const date = dateStr || todayWIB();
  const map = await fetchDayData(db, user.id, date);
  const s = dailySummary(map, date);
  const { label, hari } = formatDateID(date, true);
  const lines = [
    `📅 *${hari}, ${label}*`,
    '',
    `Pendapatan   : ${formatRp(s.income)}`,
    `Pengeluaran  : ${formatRp(s.total_expense)}`
  ];
  if (s.daily_expense > 0) lines.push(`  └ harian: ${formatRp(s.daily_expense)}${s.expense_note ? ` (${s.expense_note})` : ''}`);
  if (s.weekly_expense > 0) lines.push(`  └ bahan baku: ${formatRp(s.weekly_expense)}`);
  lines.push(`*Laba bersih : ${formatRp(s.net)}*`);
  if (!s.has_data) lines.push('', '_Belum ada data untuk tanggal ini._');
  return lines.join('\n');
}

export async function lihatBulan(db, user, baseDate) {
  const mStart = monthStart(baseDate || todayWIB());
  const y = Number(mStart.slice(0, 4));
  const m = Number(mStart.slice(5, 7));
  const end = `${mStart.slice(0, 8)}${String(daysInMonth(y, m)).padStart(2, '0')}`;
  const map = await fetchRangeData(db, user.id, mStart, end);
  const s = monthlySummary(map, mStart, daysInMonth);
  const best = s.rows.filter((r) => r.has_data).sort((a, b) => b.net - a.net)[0];
  const lines = [
    `📊 *Ringkasan ${monthNameID(m)} ${y}*`,
    '',
    `Pendapatan     : ${formatRp(s.total_income)}`,
    `Pengeluaran    : ${formatRp(s.total_expense)}`,
    `*Laba bersih  : ${formatRp(s.total_net)}*`,
    '',
    `Hari tercatat: ${s.active_days}`
  ];
  if (best) {
    const bestInfo = formatDateID(best.date, true);
    lines.push(`Hari terbaik: ${bestInfo.hari}, ${bestInfo.label} (${formatRp(best.net)})`);
  }
  lines.push('', 'Lihat detail: buka web dashboard 📈');
  return lines.join('\n');
}

export async function history7Hari(db, user) {
  const end = todayWIB();
  const start = addDays(end, -6);
  const map = await fetchRangeData(db, user.id, start, end);
  const lines = ['📅 *7 Hari Terakhir*', ''];
  let total = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const s = dailySummary(map, d);
    total += s.net;
    const { label, hari } = formatDateID(d, true);
    if (!s.has_data) {
      lines.push(`${label} — _belum ada data_`);
    } else {
      lines.push(`${hari}, ${label} — ${formatRp(s.income)} - ${formatRp(s.total_expense)} = *${formatRp(s.net)}*`);
    }
  }
  lines.push('', `*Total 7 hari: ${formatRp(total)}*`);
  return lines.join('\n');
}

/* ---------------- token dashboard ---------------- */

export async function generateDashboardToken(db, user) {
  const token = generateToken();
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { error } = await db
    .from('users')
    .update({
      auth_token: token,
      token_created_at: now.toISOString(),
      token_expires_at: expires.toISOString(),
      updated_at: now.toISOString()
    })
    .eq('id', user.id);
  if (error) throw error;
  return { token, expiresAt: expires };
}

/* ---------------- reminder 18:00 WIB ---------------- */

/**
 * Kirim reminder ke satu user jika belum ada laporan hari ini.
 * Idempoten & race-safe:
 *   1. select dulu — kalau sudah ada row sent/skipped → jangan kirim.
 *   2. insert sebagai claim; kalau konflik unique (23505, cron ganda
 *      hampir bersamaan) → anggap sudah dikirim proses lain.
 *   3. gagal kirim → status 'failed' (bisa di-retry aman).
 * @returns {sent|exists|skipped|failed}
 */
export async function processReminderForUser(db, sendFn, user, dateStr, botToken) {
  const today = dateStr || todayWIB();

  // Sudah lapor hari ini?
  const txRes = await db.from('transactions').select('id').eq('user_id', user.id).eq('date', today);
  if (txRes.error) throw txRes.error;
  if ((txRes.data || []).length > 0) {
    await db.from('daily_reminders').upsert({
      user_id: user.id, reminder_date: today, reminder_type: 'daily_input_18_00',
      status: 'skipped', sent_at: new Date().toISOString()
    }, { onConflict: 'user_id,reminder_date,reminder_type' });
    return 'skipped';
  }

  const text =
    '⏰ *Pengingat*\n\n' +
    'Kamu belum mengisi laporan hari ini.\n' +
    'Ketik /lapor untuk mencatat pendapatan dan pengeluaran.';

  // Cek reminder yang sudah ada untuk (user, tanggal) ini
  const existing = await db.from('daily_reminders')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('reminder_date', today)
    .eq('reminder_type', 'daily_input_18_00');
  if (existing.error) throw existing.error;

  if ((existing.data || []).length > 0) {
    const prev = existing.data[0];
    if (prev.status !== 'failed') return 'exists'; // sent/skipped → jangan usik
    // retry aman untuk yang failed
    try {
      await sendFn(user.telegram_id, text, botToken);
      await db.from('daily_reminders')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', prev.id);
      return 'sent';
    } catch {
      return 'failed';
    }
  }

  // Claim slot lewat INSERT — konflik unique = cron lain sudah mengirim.
  const ins = await db.from('daily_reminders').insert({
    user_id: user.id, reminder_date: today, reminder_type: 'daily_input_18_00',
    status: 'sent', sent_at: new Date().toISOString()
  });
  if (ins.error) {
    if (ins.error.code === '23505') return 'exists';
    throw ins.error;
  }

  try {
    await sendFn(user.telegram_id, text, botToken);
    return 'sent';
  } catch {
    await db.from('daily_reminders')
      .update({ status: 'failed' })
      .eq('user_id', user.id)
      .eq('reminder_date', today)
      .eq('reminder_type', 'daily_input_18_00');
    return 'failed';
  }
}

export async function retryFailedReminders(db, sendFn, dateStr, botToken) {
  const today = dateStr || todayWIB();
  const res = await db.from('daily_reminders')
    .select('id, user_id, users(telegram_id)')
    .eq('reminder_date', today).eq('status', 'failed');
  if (res.error) throw res.error;
  let recovered = 0;
  for (const r of res.data || []) {
    const tgId = r.users?.telegram_id;
    if (!tgId) continue;
    try {
      await sendFn(tgId, '⏰ *Pengingat*\n\nKamu belum mengisi laporan hari ini.\nKetik /lapor untuk mencatat pendapatan dan pengeluaran.', botToken);
      await db.from('daily_reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', r.id);
      recovered++;
    } catch { /* biarkan failed */ }
  }
  return recovered;
}

/* ---------------- dispatcher utama ---------------- */

/**
 * @returns {string|null} reply text (null = tidak ada reply)
 */
export async function processUpdate(db, update, sendFn, botToken, appUrl) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return null;
  const chatId = msg.chat.id;
  const tgUser = msg.from;
  if (!tgUser) return null;
  const text = msg.text.trim();

  const user = await ensureUser(db, tgUser.id, tgUser.first_name);

  // /start → reset state + menu
  if (text.startsWith('/start')) {
    await setBotState(db, user.id, null);
    return [
      `Halo${user.name ? ' ' + user.name : ''}! 👋`,
      '',
      'Aku *Dimanage*, asisten pencatat keuangan penjual ubi cilembu panggang.',
      '',
      helpText()
    ].join('\n');
  }

  if (text.startsWith('/help')) return helpText();

  // command baru selalu reset state yang menggantung
  const isCommand = text.startsWith('/');
  let state = user.bot_state || null;

  if (text.startsWith('/lapor')) {
    return startLapor(db, user);
  }
  if (text.startsWith('/beli_bahan')) {
    return startBeliBahan(db, user);
  }
  if (text.startsWith('/lihat_hari')) return lihatHari(db, user);
  if (text.startsWith('/lihat_bulan')) return lihatBulan(db, user);
  if (text.startsWith('/history')) return history7Hari(db, user);
  if (text.startsWith('/token')) {
    const { token, expiresAt } = await generateDashboardToken(db, user);
    const base = appUrl || 'https://dimanage.vercel.app';
    return [
      '🔑 *Akses Web Dashboard*',
      '',
      'Klik link ini untuk buka dashboard:',
      `${base}/?token=${token}`,
      '',
      `Berlaku sampai ${expiresAt.toISOString().slice(0, 10)} (30 hari).`,
      'Ketik /token lagi kalau butuh link baru.'
    ].join('\n');
  }

  if (isCommand) {
    return 'Perintah tidak dikenal 🤔\n\n' + helpText();
  }

  // lanjutkan flow yang aktif
  if (state && state.flow === 'lapor') {
    return handleLaporStep(db, user, state, text);
  }
  if (state && state.flow === 'beli_bahan') {
    return handleBeliBahanStep(db, user, state, text);
  }

  return 'Ketik /lapor untuk catat penjualan hari ini, atau /help untuk lihat semua perintah.';
}

function monthNameID(m) {
  const names = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return names[m - 1];
}