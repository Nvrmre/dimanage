import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeByDate, dailySummary, weeklySummary, monthlySummary, daysInMonth } from '../api/_lib/summary.js';
import { dateRange } from '../api/_lib/dates.js';

const tx = (date, income, daily_expense = 0) => ({ date, income, daily_expense });
const wx = (expense_date, amount) => ({ expense_date, amount, category: 'bahan_baku' });

test('mergeByDate: daily + weekly expense di tanggal yang sama', () => {
  const map = mergeByDate([tx('2026-09-10', 500000, 50000)], [wx('2026-09-10', 2000000)]);
  const row = map.get('2026-09-10');
  assert.equal(row.income, 500000);
  assert.equal(row.daily_expense, 50000);
  assert.equal(row.weekly_expense, 2000000);
  assert.equal(row.has_report, true);
});

test('dailySummary: laba = income - (daily + weekly), tidak dihitung dua kali', () => {
  const map = mergeByDate([tx('2026-09-10', 500000, 50000)], [wx('2026-09-10', 2000000)]);
  const s = dailySummary(map, '2026-09-10');
  assert.equal(s.total_expense, 2050000);
  assert.equal(s.net, 500000 - 2050000);
  assert.equal(s.has_data, true);
});

test('dailySummary: tanggal tanpa data → has_data false, bukan dianggap income', () => {
  const map = mergeByDate([], []);
  const s = dailySummary(map, '2026-09-11');
  assert.equal(s.income, 0);
  assert.equal(s.total_expense, 0);
  assert.equal(s.net, 0);
  assert.equal(s.has_data, false);
  assert.equal(s.has_report, false);
});

test('weeklySummary: 7 hari Senin–Minggu, total = SUM harian', () => {
  const map = mergeByDate(
    [
      tx('2026-09-14', 400000, 25000), // Senin
      tx('2026-09-15', 600000, 75000),
      tx('2026-09-16', 500000),        // Rabu
      tx('2026-09-20', 300000, 100000) // Minggu
    ],
    [wx('2026-09-17', 1500000)]        // Kamis (beban bahan baku)
  );
  const w = weeklySummary(map, '2026-09-14', dateRange);
  assert.equal(w.days.length, 7);
  assert.equal(w.total_income, 1_800_000);
  assert.equal(w.total_expense, 200_000 + 1_500_000);
  assert.equal(w.total_net, 1_800_000 - 1_700_000);
  // cek satu baris harian
  const kamis = w.days.find((d) => d.date === '2026-09-17');
  assert.equal(kamis.net, -1_500_000);
});

test('monthlySummary: akumulasi bulanan = total income - total expense', () => {
  const map = mergeByDate(
    [tx('2026-09-01', 500000, 50000), tx('2026-09-30', 600000, 75000)],
    [wx('2026-09-05', 2000000)]
  );
  const m = monthlySummary(map, '2026-09-01', daysInMonth);
  assert.equal(m.rows.length, 30); // September punya 30 hari
  assert.equal(m.total_income, 1_100_000);
  assert.equal(m.total_expense, 125_000 + 2_000_000);
  assert.equal(m.total_net, 1_100_000 - 2_125_000);
  assert.equal(m.active_days, 3);
});

test('monthlySummary: Februari kabisat vs non-kabisat', () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  const m = monthlySummary(mergeByDate([], []), '2026-02-01', daysInMonth);
  assert.equal(m.rows.length, 28);
});

test('expense weekly di laporan bulanan tidak dobel dengan daily', () => {
  // expense hanya di weekly_expenses; daily_expense beda tanggal
  const map = mergeByDate(
    [tx('2026-09-01', 0, 100000)],
    [wx('2026-09-01', 500000)]
  );
  const s = dailySummary(map, '2026-09-01');
  assert.equal(s.total_expense, 600000); // 100rb + 500rb, BUKAN 1.1jt
});
