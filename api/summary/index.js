// /api/summary?view=daily|weekly|monthly — sumber data dashboard.
// view=daily   → ?date=YYYY-MM-DD (default hari ini WIB)
// view=weekly  → ?date=YYYY-MM-DD (minggu yang memuat tanggal itu)
// view=monthly → ?month=YYYY-MM (default bulan ini WIB)
import { getSupabase } from '../_lib/db.js';
import { ok, badRequest, unauthorized, serverError, authenticateUser } from '../_lib/http.js';
import { todayWIB, parseDate, weekStart, monthStart, addDays, addMonths, dateRange, formatDateID, monthLabelID } from '../_lib/dates.js';
import { mergeByDate, dailySummary, weeklySummary, monthlySummary, daysInMonth } from '../_lib/summary.js';

export async function buildSummary(db, user, view, params) {
  const today = todayWIB();

  if (view === 'daily') {
    const date = params.date && parseDate(params.date) ? params.date : today;
    const map = await fetchMap(db, user.id, date, date);
    const summary = dailySummary(map, date);
    return {
      view: 'daily',
      date,
      label: formatDateID(date, true),
      nav: { prev: addDays(date, -1), next: addDays(date, 1) },
      today,
      ...summary
    };
  }

  if (view === 'weekly') {
    const anchor = params.date && parseDate(params.date) ? params.date : today;
    const ws = weekStart(anchor);
    const we = addDays(ws, 6);
    const map = await fetchMap(db, user.id, ws, we);
    const summary = weeklySummary(map, ws, dateRange);
    return {
      view: 'weekly',
      week_start: ws,
      week_end: we,
      label: { start: formatDateID(ws).label, end: formatDateID(we).label },
      nav: { prev: addDays(ws, -7), next: addDays(ws, 7) },
      today,
      ...summary
    };
  }

  if (view === 'monthly') {
    const mStr = /^\d{4}-\d{2}$/.test(params.month || '') ? params.month + '-01' : monthStart(today);
    const end = `${mStr.slice(0, 8)}${String(daysInMonth(Number(mStr.slice(0, 4)), Number(mStr.slice(5, 7)))).padStart(2, '0')}`;
    const map = await fetchMap(db, user.id, mStr, end);
    const summary = monthlySummary(map, mStr, daysInMonth);
    // navigasi bulan
    const prevM = addMonths(mStr, -1).slice(0, 7);
    const nextM = addMonths(mStr, 1).slice(0, 7);
    // minggu-mingguan dalam bulan (untuk grid kalender, mulai Senin sebelum/es tanggal 1)
    const gridStart = weekStart(mStr);
    const gridEnd = weekStart(end);
    return {
      view: 'monthly',
      month: mStr.slice(0, 7),
      label: monthLabelID(mStr.slice(0, 7)),
      nav: { prev: prevM, next: nextM },
      grid_start: gridStart,
      grid_end: addDays(gridEnd, 6),
      today,
      ...summary
    };
  }

  throw Object.assign(new Error('view harus daily|weekly|monthly'), { statusCode: 400 });
}

async function fetchMap(db, userId, start, end) {
  const [tx, wx] = await Promise.all([
    db.from('transactions').select('*').eq('user_id', userId).gte('date', start).lte('date', end),
    db.from('weekly_expenses').select('*').eq('user_id', userId).gte('expense_date', start).lte('expense_date', end)
  ]);
  if (tx.error) throw tx.error;
  if (wx.error) throw wx.error;
  return mergeByDate(tx.data || [], wx.data || []);
}

export default async function handler(req, res) {
  try {
    const db = getSupabase();
    const user = await authenticateUser(req, db);
    if (!user) return unauthorized(res, 'Token tidak valid/kedaluwarsa. Ketik /token di bot.');

    const q = req.query || {};
    const one = (v) => (Array.isArray(v) ? v[0] : v);
    const view = one(q.view) || 'monthly';
    const params = { date: one(q.date), month: one(q.month) };
    const result = await buildSummary(db, user, view, params);
    return ok(res, result);
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    return serverError(res, err);
  }
}
