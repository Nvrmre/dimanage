import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRp, parseAmount, netProfit } from '../api/_lib/format.js';

test('formatRp penuh (pemisah ribuan Indonesia)', () => {
  assert.equal(formatRp(500000), 'Rp500.000');
  assert.equal(formatRp(1500000), 'Rp1.500.000');
  assert.equal(formatRp(0), 'Rp0');
});

test('formatRp compact', () => {
  assert.equal(formatRp(1500000, { compact: true }), 'Rp1,5jt');
  assert.equal(formatRp(2000000, { compact: true }), 'Rp2jt');
  assert.equal(formatRp(500000, { compact: true }), 'Rp500rb');
  assert.equal(formatRp(-75000, { compact: true }), '-Rp75rb');
  assert.equal(formatRp(2500000000, { compact: true }), 'Rp2,5M');
});

test('parseAmount: pola umum user Indonesia', () => {
  assert.equal(parseAmount('500000'), 500000);
  assert.equal(parseAmount('500.000'), 500000);
  assert.equal(parseAmount('1.500.000'), 1500000);
  assert.equal(parseAmount('2jt'), 2000000);
  assert.equal(parseAmount('1,5jt'), 1500000);
  assert.equal(parseAmount('50 rb'), 50000);
  assert.equal(parseAmount('50k'), 50000);
  assert.equal(parseAmount('Rp500.000'), 500000);
  assert.equal(parseAmount(' 70000 '), 70000);
});

test('parseAmount: invalid → null', () => {
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('-5000'), null);
  assert.equal(parseAmount('1.2.3'), null);
  assert.equal(parseAmount(null), null);
});

test('parseAmount: desimal koma dibulatkan ke integer rupiah', () => {
  assert.equal(parseAmount('1,5jt'), 1500000);
  assert.equal(parseAmount('10,5rb'), 10500);
});

test('netProfit: income dikurangi seluruh pengeluaran', () => {
  assert.equal(netProfit({ income: 500000, daily_expense: 50000, weekly_expense: 0 }), 450000);
  assert.equal(netProfit({ income: 500000, daily_expense: 50000, weekly_expense: 2000000 }), -1550000);
});
