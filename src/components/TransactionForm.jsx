import React, { useState } from 'react';
import { parseAmount, formatRp } from '../utils/index.js';

/** Modal form input/edit transaksi harian (fallback input via web). */
export default function TransactionForm({ initial, onClose, onSubmit, onDelete }) {
  const editing = !!(initial && initial.id);
  const [date, setDate] = useState((initial && initial.date) || todayStr());
  const [income, setIncome] = useState(initial && initial.id ? String(initial.income ?? 0) : '');
  const [expense, setExpense] = useState(initial && initial.id ? String(initial.daily_expense ?? 0) : '');
  const [note, setNote] = useState((initial && initial.expense_note) || '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function todayStr() {
    // hindari dependensi util saat initial tidak ada — pakai WIB
    const now = new Date(Date.now() + 7 * 3600_000);
    return now.toISOString().slice(0, 10);
  }

  const submit = async (e) => {
    e.preventDefault();
    const inc = parseAmount(income) ?? 0;
    const exp = parseAmount(expense) ?? 0;
    if (inc === 0 && exp === 0) {
      setError('Isi pendapatan atau pengeluaran.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ date, income: inc, daily_expense: exp, expense_note: note.trim() || null }, editing ? initial.id : null);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const del = async () => {
    if (!window.confirm('Hapus transaksi ini?')) return;
    setBusy(true);
    try { await onDelete(initial.id); } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{editing ? 'Edit Transaksi' : 'Input Transaksi'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Tutup">Tutup</button>
        </div>

        <form onSubmit={submit}>
          <label className="field-label" htmlFor="tx-date">Tanggal</label>
          <input id="tx-date" className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

          <label className="field-label" htmlFor="tx-income">Pendapatan</label>
          <input id="tx-income" className="field-input" inputMode="numeric" placeholder="contoh: 500000"
            value={income} onChange={(e) => setIncome(e.target.value)} />

          <label className="field-label" htmlFor="tx-expense">Pengeluaran hari ini</label>
          <input id="tx-expense" className="field-input" inputMode="numeric" placeholder="contoh: 50000 (boleh kosong)"
            value={expense} onChange={(e) => setExpense(e.target.value)} />

          <label className="field-label" htmlFor="tx-note">Keterangan pengeluaran</label>
          <input id="tx-note" className="field-input" placeholder="contoh: bensin (boleh kosong)"
            value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            {editing && (
              <button type="button" className="btn btn-danger" onClick={del} disabled={busy}>Hapus</button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
