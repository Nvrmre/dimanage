// GET|POST /api/telegram/cron-reminder — Vercel Cron (11:00 UTC = 18:00 WIB).
// Idempoten: lihat processReminderForUser (daily_reminders unique constraint).
import { getSupabase } from '../_lib/db.js';
import { ok, unauthorized, serverError } from '../_lib/http.js';
import { processReminderForUser, retryFailedReminders } from '../_lib/bot.js';
import { todayWIB, timeWIB } from '../_lib/dates.js';
import { sendTelegramMessage } from './webhook.js';

function authorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${cronSecret}`) return true;
  // Vercel Cron mengirim header ini otomatis
  if (req.headers['x-vercel-cron'] && !auth) return true;
  return false;
}

export default async function handler(req, res) {
  if (!authorized(req)) return unauthorized(res, 'Gunakan Bearer CRON_SECRET');

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return serverError(res, new Error('TELEGRAM_BOT_TOKEN belum diset'));

  const today = todayWIB();
  const wib = timeWIB();

  try {
    const db = getSupabase();
    // Safety: kalau cron fire sebelum 18:00 WIB (mis. manual trigger),
    // jangan kirim — kecuali dipaksa lewat ?force=1.
    const force = req.query?.force === '1' || new URL(req.url, 'http://x').searchParams.get('force') === '1';
    if (wib < '18:00' && !force) {
      return ok(res, { ok: true, skipped: true, reason: `Belum 18:00 WIB (sekarang ${wib})`, date: today });
    }

    const usersRes = await db.from('users').select('id, telegram_id, name');
    if (usersRes.error) throw usersRes.error;

    let sent = 0, skipped = 0, failed = 0, exists = 0;
    for (const user of usersRes.data || []) {
      try {
        const r = await processReminderForUser(db, sendTelegramMessage, user, today, botToken);
        if (r === 'sent') sent++;
        else if (r === 'skipped') skipped++;
        else if (r === 'failed') failed++;
        else exists++;
      } catch (e) {
        console.error('[cron-reminder] user', user.id, e);
        failed++;
      }
    }

    // retry pengiriman yang gagal (aman karena idempoten)
    let recovered = 0;
    if (failed > 0) {
      try { recovered = await retryFailedReminders(db, sendTelegramMessage, today, botToken); } catch {}
    }

    return ok(res, { ok: true, date: today, wib_time: wib, sent, skipped, already: exists, failed, recovered });
  } catch (err) {
    return serverError(res, err);
  }
}
