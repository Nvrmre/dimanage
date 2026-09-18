// GET /api/health — health check sederhana.
export default async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    ok: true,
    service: 'dimanage',
    time: new Date().toISOString(),
    env: {
      supabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      cron_secret: !!process.env.CRON_SECRET
    }
  }));
}
