// Integration test alur bot PENUH dengan fake DB (in-memory, perilaku Supabase-
// like: chaining eq/gte/lte, thenable, unique violation 23505) dan fake Telegram
// sender. Tidak butuh jaringan / env asli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processUpdate, processReminderForUser } from '../api/_lib/bot.js';

/* ---------- fake Supabase ---------- */

const UNIQUES = {
  users: [['telegram_id'], ['auth_token']],
  transactions: [['user_id', 'date']],
  weekly_expenses: [['user_id', 'week_start', 'category']],
  daily_reminders: [['user_id', 'reminder_date', 'reminder_type']]
};

function fakeDB() {
  const state = { users: [], transactions: [], weekly_expenses: [], daily_reminders: [] };

  function builder(table) {
    const t = state[table];
    let filters = []; // [key, op, value]
    let mode = null;  // select|insert|update|delete|upsert
    let patch = null;
    let payload = null;
    let upsertOpts = null;
    let limitOne = false;

    const matches = (r) => filters.every(([k, op, v]) => {
      if (op === 'eq') return r[k] === v;
      if (op === 'gte') return String(r[k]) >= String(v);
      if (op === 'lte') return String(r[k]) <= String(v);
      return true;
    });

    async function exec() {
      if (mode === 'select') {
        const rows = t.filter(matches);
        if (limitOne) {
          return rows[0]
            ? { data: rows[0], error: null }
            : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        }
        return { data: rows, error: null };
      }
      if (mode === 'insert') {
        const row = { ...(Array.isArray(payload) ? payload[0] : payload) };
        // unique violation check
        for (const combo of UNIQUES[table] || []) {
          if (combo.every((k) => row[k] !== undefined && row[k] !== null)) {
            if (t.some((r) => combo.every((k) => r[k] === row[k]))) {
              return { data: null, error: { code: '23505', message: 'duplicate key' } };
            }
          }
        }
        if (table === 'users') row.id = row.id || 'u-' + (state.users.length + 1);
        t.push(row);
        if (limitOne) return { data: row, error: null };
        return { data: row, error: null };
      }
      if (mode === 'upsert') {
        const row = { ...payload };
        const keys = (upsertOpts?.onConflict || '').split(',').map((s) => s.trim()).filter(Boolean);
        const idx = keys.length
          ? t.findIndex((r) => keys.every((k) => r[k] === row[k]))
          : -1;
        if (idx >= 0) {
          t[idx] = { ...t[idx], ...row };
          return { data: t[idx], error: null };
        }
        if (table === 'users') row.id = row.id || 'u-' + (state.users.length + 1);
        t.push(row);
        return { data: row, error: null };
      }
      if (mode === 'update') {
        const rows = t.filter(matches);
        for (let i = 0; i < t.length; i++) {
          if (matches(t[i])) t[i] = { ...t[i], ...patch };
        }
        if (limitOne) {
          return rows[0]
            ? { data: rows[0], error: null }
            : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        }
        return { data: rows.length ? rows : null, error: null };
      }
      if (mode === 'delete') {
        const rows = t.filter(matches);
        for (let i = t.length - 1; i >= 0; i--) {
          if (matches(t[i])) t.splice(i, 1);
        }
        if (limitOne) {
          return rows[0]
            ? { data: rows[0], error: null }
            : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        }
        return { data: rows, error: null };
      }
      return { data: t.slice(), error: null };
    }

    const api = {
      select() { if (!mode) mode = 'select'; return api; },
      single() { limitOne = true; return api; },
      insert(p) { mode = 'insert'; payload = p; return api; },
      update(p) { mode = 'update'; patch = p; return api; },
      delete() { mode = 'delete'; return api; },
      upsert(p, opts) { mode = 'upsert'; payload = p; upsertOpts = opts || {}; return api; },
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
    from: (table) => {
      if (!state[table]) state[table] = [];
      return builder(table);
    }
  };
}

/* ---------- fake update builder ---------- */

function tgUpdate(text, tgId = 424242, firstName = 'Test') {
  return {
    message: { chat: { id: tgId }, from: { id: tgId, first_name: firstName }, text }
  };
}

function fakeSender() {
  const sent = [];
  return {
    sent,
    send: async (chatId, text) => { sent.push({ chatId, text }); }
  };
}

/* ---------- tests ---------- */

test('alur /lapor lengkap: income → expense → note → tersimpan', async () => {
  const db = fakeDB();
  const sender = fakeSender();

  let reply = await processUpdate(db, tgUpdate('/lapor'), sender.send, 'TOK', 'https://app.test');
  assert.match(reply, /pendapatan/i);

  const user = db.state.users[0];
  assert.equal(user.telegram_id, 424242);

  reply = await processUpdate(db, tgUpdate('500000'), sender.send, 'TOK');
  assert.match(reply, /pengeluaran/i);

  reply = await processUpdate(db, tgUpdate('50000'), sender.send, 'TOK');
  assert.match(reply, /keterangan/i);

  reply = await processUpdate(db, tgUpdate('bensin'), sender.send, 'TOK');
  assert.match(reply, /tersimpan/i);
  assert.match(reply, /Rp500\.000/);
  assert.match(reply, /Rp450\.000/); // laba

  const txRow = db.state.transactions[0];
  assert.equal(txRow.income, 500000);
  assert.equal(txRow.daily_expense, 50000);
  assert.equal(txRow.expense_note, 'bensin');
  assert.equal(db.state.users[0].bot_state, null);
});

test('alur /lapor tanpa pengeluaran: ketik "tidak" langsung selesai', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  await processUpdate(db, tgUpdate('/lapor'), sender.send, 'TOK');
  await processUpdate(db, tgUpdate('600000'), sender.send, 'TOK');
  const reply = await processUpdate(db, tgUpdate('tidak'), sender.send, 'TOK');
  assert.match(reply, /tersimpan/i);
  assert.match(reply, /Rp600\.000/);
  const txRow = db.state.transactions[0];
  assert.equal(txRow.daily_expense, 0);
});

test('validasi: income bukan angka ditolak, flow tidak mati', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  await processUpdate(db, tgUpdate('/lapor'), sender.send, 'TOK');
  let reply = await processUpdate(db, tgUpdate('mahal banget'), sender.send, 'TOK');
  assert.match(reply, /harus angka/i);
  reply = await processUpdate(db, tgUpdate('450000'), sender.send, 'TOK');
  assert.match(reply, /pengeluaran/i);
});

test('lapor dua kali hari yang sama → overwrite (upsert), bukan dobel baris', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  await processUpdate(db, tgUpdate('/lapor'), sender.send, 'TOK');
  await processUpdate(db, tgUpdate('500000'), sender.send, 'TOK');
  await processUpdate(db, tgUpdate('tidak'), sender.send, 'TOK');
  // lapor lagi
  await processUpdate(db, tgUpdate('/lapor'), sender.send, 'TOK');
  await processUpdate(db, tgUpdate('700000'), sender.send, 'TOK');
  await processUpdate(db, tgUpdate('0'), sender.send, 'TOK');
  assert.equal(db.state.transactions.length, 1);
  assert.equal(db.state.transactions[0].income, 700000);
});

test('input gaya "2jt" diterima di /beli_bahan, week_start terisi', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  await processUpdate(db, tgUpdate('/beli_bahan'), sender.send, 'TOK');
  let reply = await processUpdate(db, tgUpdate('2jt'), sender.send, 'TOK');
  assert.match(reply, /tanggal/i);
  reply = await processUpdate(db, tgUpdate('hari ini'), sender.send, 'TOK');
  assert.match(reply, /tercatat/i);
  assert.match(reply, /Rp2jt/);
  const wx = db.state.weekly_expenses[0];
  assert.equal(wx.amount, 2000000);
  assert.equal(wx.category, 'bahan_baku');
  assert.ok(wx.week_start);
  assert.ok(wx.expense_date);
});

test('/lihat_hari menampilkan ringkasan & laba', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  await processUpdate(db, tgUpdate('/lapor'), sender.send, 'TOK');
  await processUpdate(db, tgUpdate('500000'), sender.send, 'TOK');
  await processUpdate(db, tgUpdate('tidak'), sender.send, 'TOK');
  const reply = await processUpdate(db, tgUpdate('/lihat_hari'), sender.send, 'TOK');
  assert.match(reply, /Pendapatan/);
  assert.match(reply, /Rp500\.000/);
  assert.match(reply, /Laba bersih/);
});

test('/start register user baru + /help + command tak dikenal', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  const r1 = await processUpdate(db, tgUpdate('/start', 777, 'Ani'), sender.send, 'TOK');
  assert.match(r1, /Halo Ani/);
  const r2 = await processUpdate(db, tgUpdate('/help', 777), sender.send, 'TOK');
  assert.match(r2, /\/lapor/);
  const r3 = await processUpdate(db, tgUpdate('/ngasal', 777), sender.send, 'TOK');
  assert.match(r3, /tidak dikenal/i);
});

test('/token menghasilkan link dashboard + expiry 30 hari', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  await processUpdate(db, tgUpdate('/start', 888, 'Budi'), sender.send, 'TOK', 'https://app.test');
  const reply = await processUpdate(db, tgUpdate('/token', 888), sender.send, 'TOK', 'https://app.test');
  assert.match(reply, /https:\/\/app\.test\/\?token=/);
  const user = db.state.users[0];
  assert.ok(user.auth_token);
  const created = new Date(user.token_created_at).getTime();
  const expires = new Date(user.token_expires_at).getTime();
  assert.equal(expires - created, 30 * 24 * 3600 * 1000);
});

/* ---------- reminder idempoten ---------- */

test('reminder: terkirim sekali, tidak dobel walau cron jalan lagi', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  await processUpdate(db, tgUpdate('/start', 999, 'Cici'), sender.send, 'TOK');
  const user = db.state.users[0];

  const r1 = await processReminderForUser(db, sender.send, user, '2026-09-19', 'TOK');
  assert.equal(r1, 'sent');
  assert.equal(sender.sent.length, 1);
  assert.match(sender.sent[0].text, /Pengingat/);

  const r2 = await processReminderForUser(db, sender.send, user, '2026-09-19', 'TOK');
  assert.equal(r2, 'exists');
  assert.equal(sender.sent.length, 1);
});

test('reminder: konflik unique (cron ganda) → exists, tanpa kirim', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  await processUpdate(db, tgUpdate('/start', 555, 'Fafa'), sender.send, 'TOK');
  const user = db.state.users[0];

  // Simulasi cron lain sudah claim: insert langsung ke daily_reminders
  await db.from('daily_reminders').insert({
    user_id: user.id, reminder_date: '2026-09-19', reminder_type: 'daily_input_18_00',
    status: 'sent', sent_at: new Date().toISOString()
  });

  const r = await processReminderForUser(db, sender.send, user, '2026-09-19', 'TOK');
  assert.equal(r, 'exists');
  assert.equal(sender.sent.length, 0);
});

test('reminder: tidak dikirim jika user sudah lapor (skipped)', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  await processUpdate(db, tgUpdate('/start', 111, 'Dedi'), sender.send, 'TOK');
  const user = db.state.users[0];
  await processUpdate(db, tgUpdate('/lapor', 111), sender.send, 'TOK');
  await processUpdate(db, tgUpdate('300000', 111), sender.send, 'TOK');
  await processUpdate(db, tgUpdate('tidak', 111), sender.send, 'TOK');

  const r = await processReminderForUser(db, sender.send, user, '2026-09-19', 'TOK');
  assert.equal(r, 'skipped');
  assert.equal(sender.sent.length, 0);
});

test('reminder: gagal kirim → status failed; retry sukses → sent', async () => {
  const db = fakeDB();
  const sender = fakeSender();
  await processUpdate(db, tgUpdate('/start', 222, 'Eka'), sender.send, 'TOK');
  const user = db.state.users[0];

  const failingSend = async () => { throw new Error('TG down'); };
  const r1 = await processReminderForUser(db, failingSend, user, '2026-09-19', 'TOK');
  assert.equal(r1, 'failed');
  assert.equal(db.state.daily_reminders[0].status, 'failed');

  // retry setelah Telegram pulih
  const r2 = await processReminderForUser(db, sender.send, user, '2026-09-19', 'TOK');
  assert.equal(r2, 'sent');
  assert.equal(db.state.daily_reminders[0].status, 'sent');
  assert.equal(sender.sent.length, 1);
});
