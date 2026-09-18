-- ============================================================
-- Dimanage — Finance Tracker Ubi Cilembu Panggang
-- Schema Supabase (jalankan di Supabase SQL Editor)
-- Semua tanggal memakai DATE (WIB, UTC+7) — bukan TIMESTAMP.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- users ----------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  name text,
  -- state percakapan bot (/lapor, /beli_bahan) supaya aman walau
  -- serverless instance cold-start (JSONB kecil, di-clear setelah selesai)
  bot_state jsonb default null,
  auth_token varchar(255) unique,
  token_created_at timestamp,
  token_expires_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- ---------- transactions (laporan harian) ----------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  income integer not null default 0 check (income >= 0),
  daily_expense integer not null default 0 check (daily_expense >= 0),
  expense_note text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (user_id, date)
);

create index if not exists idx_transactions_user_date
  on transactions(user_id, date desc);

-- ---------- weekly_expenses (bahan baku, bensin, other) ----------
create table if not exists weekly_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  week_start date not null,
  expense_date date not null,
  category varchar(50) not null check (category in ('bahan_baku','bensin','other')),
  amount integer not null check (amount >= 0),
  description text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (user_id, week_start, category)
);

create index if not exists idx_weekly_expenses_user_date
  on weekly_expenses(user_id, expense_date desc);

-- ---------- daily_reminders (idempotensi reminder 18:00 WIB) ----------
create table if not exists daily_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  reminder_date date not null,
  reminder_type varchar(50) not null default 'daily_input_18_00',
  sent_at timestamp,
  status varchar(20) not null default 'sent' check (status in ('sent','failed','skipped')),
  created_at timestamp default now(),
  unique (user_id, reminder_date, reminder_type)
);

create index if not exists idx_daily_reminders_status
  on daily_reminders(reminder_date, status);

-- ============================================================
-- Row Level Security: tabel hanya boleh diakses lewat server
-- (service role). Tidak ada policy publik — web dashboard & bot
-- selalu melewati API functions, bukan akses langsung browser.
-- ============================================================
alter table users enable row level security;
alter table transactions enable row level security;
alter table weekly_expenses enable row level security;
alter table daily_reminders enable row level security;
