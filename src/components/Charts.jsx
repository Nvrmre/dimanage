import React, { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Legend
} from 'recharts';
import { formatDateID, formatRp } from '../utils/index.js';

/**
 * Charts (tampil di view Bulanan):
 * 1. Income trend  2. Net profit trend  3. Expense breakdown per kategori
 */
export default function Charts({ rows, weeklyExps, txs, visible }) {
  const data = useMemo(
    () => (rows || []).map((r) => ({
      tanggal: String(Number(r.date.slice(8, 10))),
      Pendapatan: r.income || 0,
      'Laba bersih': r.net || 0
    })),
    [rows]
  );

  const breakdown = useMemo(() => {
    const b = { Harian: 0, 'Bahan baku': 0, Bensin: 0, Lainnya: 0 };
    for (const t of txs || []) b.Harian += t.daily_expense || 0;
    for (const w of weeklyExps || []) {
      if (w.category === 'bahan_baku') b['Bahan baku'] += w.amount;
      else if (w.category === 'bensin') b.Bensin += w.amount;
      else b.Lainnya += w.amount;
    }
    return Object.entries(b).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [txs, weeklyExps]);

  if (!visible) return null;

  return (
    <section className="charts">
      <div className="card chart-card">
        <h3>Tren Pendapatan & Laba Bersih</h3>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e6" />
              <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => short(v)} width={45} />
              <Tooltip formatter={(v) => formatRp(v)} labelFormatter={(l) => 'Tanggal ' + l} />
              <Legend />
              <Line type="monotone" dataKey="Pendapatan" stroke="#0f766e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Laba bersih" stroke="#4caf7d" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card chart-card">
        <h3>Rincian Pengeluaran</h3>
        {breakdown.length === 0 ? (
          <p className="muted">Belum ada pengeluaran bulan ini.</p>
        ) : (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={breakdown} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e6" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => short(v)} width={45} />
                <Tooltip formatter={(v) => formatRp(v)} />
                <Bar dataKey="value" name="Pengeluaran" fill="#e8916f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

function short(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'jt';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'rb';
  return v;
}
