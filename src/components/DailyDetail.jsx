import React from 'react';
import { formatDateID, formatRp } from '../utils/index.js';

/** Detail satu tanggal: pendapatan, seluruh pengeluaran (harian + bahan baku),
 *  laba bersih. Kalau tidak ada data → "Belum ada data" (bukan Rp0 income). */
export default function DailyDetail({ summary, date, tx, onEdit }) {
  if (!summary) {
    return (
      <section className="card daily-detail">
        <div className="daily-detail-head">
          <h3>{formatDateID(date, true).hari}, {formatDateID(date).label}</h3>
          <button className="btn btn-primary btn-sm" onClick={onEdit}>+ Input Transaksi</button>
        </div>
        <p className="muted">Belum ada data untuk tanggal ini.</p>
      </section>
    );
  }
  const info = formatDateID(date, true);
  const hasData = summary.has_data;

  return (
    <section className="card daily-detail">
      <div className="daily-detail-head">
        <h3>{info.hari}, {info.label}</h3>
        <button className="btn btn-primary btn-sm" onClick={onEdit}>
          {tx ? 'Edit Transaksi' : '+ Input Transaksi'}
        </button>
      </div>
      {!hasData ? (
        <p className="muted">Belum ada data untuk tanggal ini.</p>
      ) : (
        <table className="detail-table">
          <tbody>
            <tr>
              <td>Pendapatan</td>
              <td className="num pos">{formatRp(summary.income)}</td>
            </tr>
            {summary.daily_expense > 0 && (
              <tr>
                <td>Pengeluaran harian{summary.expense_note ? ` (${summary.expense_note})` : ''}</td>
                <td className="num neg">-{formatRp(summary.daily_expense)}</td>
              </tr>
            )}
            {summary.weekly_expense > 0 && (
              <tr>
                <td>Belanja bahan baku</td>
                <td className="num neg">-{formatRp(summary.weekly_expense)}</td>
              </tr>
            )}
            <tr className="detail-total">
              <td>Laba bersih</td>
              <td className={'num ' + (summary.net >= 0 ? 'pos' : 'neg')}>{formatRp(summary.net)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
