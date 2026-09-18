// POST /api/auth/generate-token — generate token dashboard.
// Dipakai oleh bot (service) ATAU oleh user yang sudah punya token valid (rotate).
import { getSupabase } from '../_lib/db.js';
import { ok, unauthorized, serverError, readBody, authenticateUser } from '../_lib/http.js';
import { generateDashboardToken, getUserByTelegramId } from '../_lib/bot.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return ok(res, { error: 'POST only' });
  try {
    const db = getSupabase();
    const body = await readBody(req);

    // Path 1: service call dengan telegram_id (dari bot flow)
    if (body.telegram_id && process.env.CRON_SECRET &&
        req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`) {
      const user = await getUserByTelegramId(db, Number(body.telegram_id));
      if (!user) return unauthorized(res, 'User belum terdaftar (ketik /start di bot)');
      const { token, expiresAt } = await generateDashboardToken(db, user);
      return ok(res, { token, expires_at: expiresAt.toISOString() });
    }

    // Path 2: rotate oleh user dengan token valid
    const user = await authenticateUser(req, db);
    if (!user) return unauthorized(res, 'Token tidak valid/kedaluwarsa. Ketik /token di bot.');
    const { token, expiresAt } = await generateDashboardToken(db, user);
    return ok(res, { token, expires_at: expiresAt.toISOString() });
  } catch (err) {
    return serverError(res, err);
  }
}
