# Dimanage — Finance Tracker Ubi Cilembu Panggang

Sistem pencatat keuangan sederhana untuk UMKM: input harian via **bot Telegram**, review & summary via **web dashboard**.

- Income & pengeluaran harian (`/lapor`)
- Belanja bahan baku dengan tanggal beban (`/beli_bahan`)
- Reminder otomatis **18:00 WIB** jika belum lapor (idempoten)
- Dashboard: filter **Harian / Mingguan / Bulanan**, calendar grid, charts laba bersih

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Hosting | Vercel (static + serverless functions) |
| Database | Supabase (PostgreSQL) |
| Bot | Telegram Bot API (webhook) |
| Reminder | Vercel Cron → `11:00 UTC` = `18:00 WIB` |

## Setup

### 1. Database
Buka Supabase → SQL Editor → jalankan [`supabase/schema.sql`](supabase/schema.sql).

### 2. Bot Telegram
1. Buat bot via @BotFather → ambil token.
2. Set webhook (ganti domain & secret):
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<domain-anda>/api/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

### 3. Deploy ke Vercel
```bash
vercel link
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_WEBHOOK_SECRET
vercel env add CRON_SECRET
vercel env add APP_URL          # https://<domain-anda>
vercel --prod
```

`vercel.json` sudah memuat cron harian (`0 11 * * *` UTC = 18:00 WIB) yang memanggil `/api/telegram/cron-reminder`.

## Env variables

Lihat [`.env.example`](.env.example). Semua secret hanya di Vercel — tidak pernah di-commit.

## Struktur

```
api/                  # Vercel serverless functions
  _lib/               #   bot engine, summary math, tanggal WIB, format Rp
  telegram/webhook.js #   webhook bot (/lapor, /beli_bahan, /token, ...)
  telegram/cron-reminder.js # reminder 18:00 WIB (idempoten)
  transactions.js     #   GET/POST transaksi harian
  transactions/[id].js#   PUT/DELETE (ownership-checked)
  summary/index.js    #   ?view=daily|weekly|monthly
  auth/               #   generate-token & verify
supabase/schema.sql   # skema DB + RLS
src/                  # React dashboard
test/                 # unit + integration test (node --test)
```

## Development

```bash
npm install
npm test          # test logika tanggal, format, summary, bot flow
npm run dev       # frontend only (butuh API via vercel dev)
```
