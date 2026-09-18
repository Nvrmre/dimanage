import React from 'react';
import { formatDateID, formatRp } from '../utils/index.js';

/** Modal detail satu tanggal: breakdown income, daily expense, bahan baku, net. */
export default function DayDetailModal({ date, summary, tx, onClose, onEdit }) {
  const info = formatDateID(date, true);
  const hasData = summary.has_data;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card day-detail-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{info.hari}, {info.label}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Tutup">Tutup</button>
        </div>

        {!hasData ? (
          <p className="muted">Belum ada data untuk tanggal ini.</p>
        ) : (
          <>
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
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={onEdit}>
                {tx ? 'Edit Transaksi' : '+ Input Transaksi'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}