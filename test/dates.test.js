import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayWIB, timeWIB, parseDate, addDays, addMonths, weekStart, monthStart, dateRange, formatDateID, monthLabelID } from '../api/_lib/dates.js';

test('parseDate: valid & invalid', () => {
  assert.ok(parseDate('2026-09-19'));
  assert.equal(parseDate('2026-02-30'), null);   // tanggal tidak ada
  assert.equal(parseDate('2026-13-01'), null);
  assert.equal(parseDate('19-09-2026'), null);
  assert.equal(parseDate(''), null);
  assert.equal(parseDate(null), null);
});

test('todayWIB: 2026-09-19 00:30 UTC (belum genap tanggal WIB)', () => {
  // 19 Sep 00:30 UTC = 19 Sep 07:30 WIB → 19
  const d = new Date('2026-09-19T00:30:00Z');
  assert.equal(todayWIB(d), '2026-09-19');
});

test('todayWIB: rollover tengah malam WIB', () => {
  // 19 Sep 16:59 UTC = 19 Sep 23:59 WIB → masih 19
  assert.equal(todayWIB(new Date('2026-09-19T16:59:00Z')), '2026-09-19');
  // 19 Sep 17:00 UTC = 20 Sep 00:00 WIB → ganti 20
  assert.equal(todayWIB(new Date('2026-09-19T17:00:00Z')), '2026-09-20');
});

test('timeWIB', () => {
  assert.equal(timeWIB(new Date('2026-09-19T11:00:00Z')), '18:00');
  assert.equal(timeWIB(new Date('2026-09-19T10:59:00Z')), '17:59');
});

test('addDays across month boundary', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-10-01', -1), '2026-09-30');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01'); // 2026 bukan kabisat
});

test('addMonths across year + clamp day', () => {
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28'); // clamp
});

test('weekStart: Senin sebagai awal minggu', () => {
  // 2026-09-19 = Sabtu → minggu mulai Senin 14 Sep
  assert.equal(weekStart('2026-09-19'), '2026-09-14');
  // 2026-09-14 = Senin → diri sendiri
  assert.equal(weekStart('2026-09-14'), '2026-09-14');
  // 2026-09-20 = Minggu → masih minggu yang mulai 14 Sep
  assert.equal(weekStart('2026-09-20'), '2026-09-14');
});

test('monthStart & dateRange', () => {
  assert.equal(monthStart('2026-09-19'), '2026-09-01');
  const range = dateRange('2026-09-29', '2026-10-02');
  assert.deepEqual(range, ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
});

test('formatDateID Indonesia', () => {
  const r = formatDateID('2026-09-19', true);
  assert.equal(r.label, '19 Sep 2026');
  assert.equal(r.hari, 'Sabtu');
  assert.equal(formatDateID('2026-09-14', true).hari, 'Senin');
});

test('monthLabelID', () => {
  assert.equal(monthLabelID('2026-09'), 'September 2026');
});
