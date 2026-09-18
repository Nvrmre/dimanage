// /api/transactions — GET (list by date/range) & POST (upsert laporan harian).
import { getSupabase } from './_lib/db.js';
import { ok, badRequest, unauthorized, serverError, readBody, authenticateUser } from './_lib/http.js';
import { parseDate, todayWIB } from './_lib/dates.js';

export default async function handler(req, res) {
  try {
    const db = getSupabase();
    const user = await authenticateUser(req, db);
    if (!user) return unauthorized(res, 'Token tidak valid/kedaluwarsa. Ketik /token di bot.');

    if (req.method === 'GET') {
      const one = (v) => (Array.isArray(v) ? v[0] : v);
      const q = { date: one(req.query?.date), from: one(req.query?.from), to: one(req.query?.to) };
      let start, end;
      if (q.from && q.to) {
        if (!parseDate(q.from) || !parseDate(q.to)) return badRequest(res, 'Format from/to harus YYYY-MM-DD');
        start = q.from; end = q.to;
      } else if (q.date) {
        if (!parseDate(q.date)) return badRequest(res, 'Format date harus YYYY-MM-DD');
        start = q.date; end = q.date;
      } else {
        end = todayWIB();
        start = todayWIB(new Date(Date.now() - 30 * 86400_000));
      }
      const [tx, wx] = await Promise.all([
        db.from('transactions').select('*').eq('user_id', user.id).gte('date', start).lte('date', end).order('date', { ascending: true }),
        db.from('weekly_expenses').select('*').eq('user_id', user.id).gte('expense_date', start).lte('expense_date', end)
      ]);
      if (tx.error) throw tx.error;
      if (wx.error) throw wx.error;
      return ok(res, { transactions: tx.data, weekly_expenses: wx.data });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const date = body.date || todayWIB();
      if (!parseDate(date)) return badRequest(res, 'Format date harus YYYY-MM-DD');
      const income = Number(body.income ?? 0);
      const dailyExpense = Number(body.daily_expense ?? 0);
      if (!Number.isFinite(income) || income < 0) return badRequest(res, 'income harus angka >= 0');
      if (!Number.isFinite(dailyExpense) || dailyExpense < 0) return badRequest(res, 'daily_expense harus angka >= 0');
      if (income === 0 && dailyExpense === 0) return badRequest(res, 'income dan daily_expense tidak boleh keduanya 0');

      const payload = {
        user_id: user.id,
        date,
        income: Math.round(income),
        daily_expense: Math.round(dailyExpense),
        expense_note: body.expense_note ? String(body.expense_note).slice(0, 200) : null,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await db.from('transactions')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select()
        .single();
      if (error) throw error;
      return ok(res, { transaction: data });
    }

    return badRequest(res, 'Method tidak didukung');
  } catch (err) {
    return serverError(res, err);
  }
}
