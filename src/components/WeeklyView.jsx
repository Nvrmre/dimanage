import React from 'react';
import { formatDateID, formatRp } from '../utils/index.js';

/** Grid 7 hari (Senin–Minggu) + total laba bersih mingguan. */
export default function WeeklyView({ summary, today, onSelectDay }) {
  if (!summary || !summary.days) return null;
  return (
    <>
      <SummaryInline
        income={summary.total_income}
        expense={summary.total_expense}
        net={summary.total_net}
        title="Total Minggu Ini"
      />
      <section className="card">
        <div className="week-grid">
          {summary.days.map((d) => {
            const info = formatDateID(d.date, true);
            return (
              <button key={d.date} className={'week-day' + (d.date === today ? ' cell-today' : '')} onClick={() => onSelectDay(d.date)}>
                <span className="week-day-name">{info.hari}</span>
                <span className="week-day-date">{info.label}</span>
                <span className={'week-day-net ' + (!d.has_data ? 'muted' : d.net > 0 ? 'pos' : d.net < 0 ? 'neg' : '')}>
                  {d.has_data ? formatRp(d.net) : '—'}
                </span>
                <span className="week-day-sub muted">
                  {d.has_data ? `masuk ${formatRp(d.income)}` : 'belum ada data'}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function SummaryInline({ income, expense, net, title }) {
  return (
    <section className="card summary-card">
      <p className="summary-title">{title}</p>
      <div className="summary-rows">
        <div className="summary-row"><span>Pendapatan</span><b className="pos">{formatRp(income)}</b></div>
        <div className="summary-row"><span>Pengeluaran</span><b className="neg">{formatRp(expense)}</b></div>
        <div className="summary-row summary-net"><span>Laba bersih</span><b className={net >= 0 ? 'pos' : 'neg'}>{formatRp(net)}</b></div>
      </div>
    </section>
  );
}
