// /api/transactions/[id] — PUT (edit) & DELETE satu transaksi.
import { getSupabase } from '../_lib/db.js';
import { ok, badRequest, unauthorized, notFound, serverError, readBody, authenticateUser } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    const db = getSupabase();
    const user = await authenticateUser(req, db);
    if (!user) return unauthorized(res, 'Token tidak valid/kedaluwarsa.');

    const id = req.query?.id || (req.url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) || [])[1];
    if (!id) return badRequest(res, 'ID transaksi tidak ditemukan di URL');

    if (req.method === 'PUT') {
      const body = await readBody(req);
      const patch = { updated_at: new Date().toISOString() };
      if (body.income !== undefined) {
        const v = Number(body.income);
        if (!Number.isFinite(v) || v < 0) return badRequest(res, 'income harus angka >= 0');
        patch.income = Math.round(v);
      }
      if (body.daily_expense !== undefined) {
        const v = Number(body.daily_expense);
        if (!Number.isFinite(v) || v < 0) return badRequest(res, 'daily_expense harus angka >= 0');
        patch.daily_expense = Math.round(v);
      }
      if (body.expense_note !== undefined) patch.expense_note = body.expense_note ? String(body.expense_note).slice(0, 200) : null;
      if (body.date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) return badRequest(res, 'Format date harus YYYY-MM-DD');
        patch.date = body.date;
      }
      const { data, error } = await db.from('transactions')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user.id) // ownership check
        .select()
        .single();
      if (error) return notFound(res, 'Transaksi tidak ditemukan');
      return ok(res, { transaction: data });
    }

    if (req.method === 'DELETE') {
      const { data, error } = await db.from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) return notFound(res, 'Transaksi tidak ditemukan');
      return ok(res, { deleted: data });
    }

    return badRequest(res, 'Method tidak didukung');
  } catch (err) {
    return serverError(res, err);
  }
}
