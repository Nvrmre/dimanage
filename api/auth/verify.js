// GET /api/auth/verify?token=... atau Authorization: Bearer — cek validitas token.
// Dipakai frontend saat login via ?token= di URL.
import { getSupabase } from '../_lib/db.js';
import { ok, badRequest, unauthorized } from '../_lib/http.js';

export default async function handler(req, res) {
  const q = req.query || {};
  let token = q.token;
  if (!token && (req.headers.authorization || '').startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token) return badRequest(res, 'token wajib (query atau Bearer)');

  const db = getSupabase();
  const now = new Date().toISOString();
  const { data } = await db.from('users')
    .select('id, name, telegram_id, token_expires_at')
    .eq('auth_token', token)
    .gte('token_expires_at', now)
    .single();

  if (!data) return unauthorized(res, 'Token tidak valid atau kedaluwarsa. Ketik /token di bot untuk link baru.');
  return ok(res, { valid: true, user: { id: data.id, name: data.name, telegram_id: data.telegram_id, expires_at: data.token_expires_at } });
}
