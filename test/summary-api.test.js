// Integration test endpoint summary: buildSummary dengan fakeDB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummary } from '../api/summary/index.js';

const UNIQUES = {};
function fakeDB(seed = {}) {
  const state = {
    users: seed.users || [],
    transactions: seed.transactions || [],
    weekly_expenses: seed.weekly_expenses || [],
    daily_reminders: []
  };
  function builder(table) {
    const t = state[table];
    let filters = []; let mode = null;
    const matches = (r) => filters.every(([k, op, v]) => {
      if (op === 'eq') return r[k] === v;
      if (op === 'gte') return String(r[k]) >= String(v);
      if (op === 'lte') return String(r[k]) <= String(v);
      return true;
    });
    async function exec() {
      const rows = t.filter(matches);
      return { data: rows, error: null };
    }
    const api = {
      select() { mode = 'select'; return api; },
      single() { return api; },
      insert() { return api; },
      update() { return api; },
      delete() { return api; },
      upsert(p) { return api; },
      eq(k, v) { filters.push([k, 'eq', v]); return api; },
      gte(k, v) { filters.push([k, 'gte', v]); return api; },
      lte(k, v) { filters.push([k, 'lte', v]); return api; },
      order() { return api; },
      then(resolve, reject) { exec().then(resolve, reject); }
    };
    return api;
  }
  return {
    state,
    from: (table) => builder(table)
  };
}

const user = { id: 'u-1', telegram_id: 1, name: 'Test' };
const seed = {
  transactions: [
    { user_id: 'u-1', date: '2026-09-14', income: 400000, daily_expense: 25000 },
    { user_id: 'u-1', date: '2026-09-15', income: 600000, daily_expense: 75000 },
    { user_id: 'u-1', date: '2026-09-20', income: 300000, daily_expense: 100000 },
    { user_id: 'u-2', date: '2026-09-15', income: 999999, daily_expense: 0 } // user lain — harus diabaikan
  ],
  weekly_expenses: [
    { user_id: 'u-1', expense_date: '2026-09-17', amount: 1500000, category: 'bahan_baku' }
  ]
};

test('summary daily: 1 tanggal, laba = income - seluruh expense', async () => {
  const db = fakeDB(seed);
  const r = await buildSummary(db, user, 'daily', { date: '2026-09-14' });
  assert.equal(r.income, 400000);
  assert.equal(r.total_expense, 25000);
  assert.equal(r.net, 375000);
  assert.equal(r.nav.prev, '2026-09-13');
  assert.equal(r.nav.next, '2026-09-15');
});

test('summary weekly: Senin–Minggu, bahan baku masuk hari beban', async () => {
  const db = fakeDB(seed);
  const r = await buildSummary(db, user, 'weekly', { date: '2026-09-16' }); // Rabu
  assert.equal(r.week_start, '2026-09-14');
  assert.equal(r.days.length, 7);
  assert.equal(r.total_income, 1_300_000); // 14+15+20, user lain diabaikan
  assert.equal(r.total_expense, 200_000 + 1_500_000);
  assert.equal(r.total_net, 1_300_000 - 1_700_000);
  assert.equal(r.nav.next, '2026-09-21');
});

test('summary monthly: default bulan ini, grid melipas bulan, akumulasi benar', async () => {
  const db = fakeDB(seed);
  const r = await buildSummary(db, user, 'monthly', { month: '2026-09' });
  assert.equal(r.month, '2026-09');
  assert.equal(r.rows.length, 30);
  assert.equal(r.total_income, 1_300_000);
  assert.equal(r.total_net, 1_300_000 - 1_700_000);
  assert.equal(r.nav.prev, '2026-08');
  assert.equal(r.nav.next, '2026-10');
  // grid mulai Senin sebelum/es 1 Sep 2026 (1 Sep = Selasa → mulai 31 Agustus)
  assert.equal(r.grid_start, '2026-08-31');
});

test('summary monthly tanpa param month → fallback bulan berjalan (WIB)', async () => {
  const db = fakeDB(seed);
  const r = await buildSummary(db, user, 'monthly', {});
  assert.match(r.month, /^\d{4}-\d{2}$/);
});

test('summary view invalid → throw statusCode 400', async () => {
  const db = fakeDB(seed);
  await assert.rejects(
    () => buildSummary(db, user, 'ngasal', {}),
    (e) => e.statusCode === 400
  );
});

test('transaksi user lain TIDAK bocor ke summary (isolasi per user)', async () => {
  const db = fakeDB(seed);
  const r = await buildSummary(db, user, 'daily', { date: '2026-09-15' });
  assert.equal(r.income, 600000); // bukan 999.999 milik u-2
});
