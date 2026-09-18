// POST /api/telegram/webhook — endpoint webhook Telegram Bot API.
import { getSupabase } from '../_lib/db.js';
import { ok, unauthorized, serverError, readBody } from '../_lib/http.js';
import { processUpdate } from '../_lib/bot.js';

const TG_API = 'https://api.telegram.org';

export async function sendTelegramMessage(chatId, text, botToken) {
  const res = await fetch(`${TG_API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return ok(res, { ok: true, hint: 'Telegram webhook endpoint (POST only)' });
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return unauthorized(res, 'TELEGRAM_WEBHOOK_SECRET belum diset');
  const got = req.headers['x-telegram-bot-api-secret-token'];
  if (got !== secret) return unauthorized(res, 'Invalid secret token');

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return serverError(res, new Error('TELEGRAM_BOT_TOKEN belum diset'));

  const body = await readBody(req);
  const appUrl = process.env.APP_URL;

  try {
    const reply = await processUpdate(getSupabase(), body, sendTelegramMessage, botToken, appUrl);
    // Reply dikirim via sendTelegramMessage di dalam processUpdate? Tidak —
    // processUpdate hanya RETURN text; pengiriman di sini agar satu titik.
    if (reply) {
      const chatId = body?.message?.chat?.id ?? body?.edited_message?.chat?.id;
      if (chatId) await sendTelegramMessage(chatId, reply, botToken);
    }
    return ok(res, { ok: true });
  } catch (err) {
    console.error('[webhook]', err);
    // Tetap 200 supaya Telegram tidak retry terus-menerus untuk error app.
    return ok(res, { ok: false, error: err.message });
  }
}
