import React from 'react';
import { formatRp } from '../utils/index.js';

/** Kartu ringkasan (income, expense, laba bersih) — dipakai view Bulanan. */
export default function SummaryCard({ income, expense, net, extra }) {
  return (
    <section className="card summary-card">
      <div className="summary-rows">
        <div className="summary-row"><span>Total Pendapatan</span><b className="pos">{formatRp(income)}</b></div>
        <div className="summary-row"><span>Total Pengeluaran</span><b className="neg">{formatRp(expense)}</b></div>
        <div className="summary-row summary-net"><span>Laba Bersih</span><b className={net >= 0 ? 'pos' : 'neg'}>{formatRp(net)}</b></div>
      </div>
      {extra && <p className="muted summary-extra">{extra}</p>}
    </section>
  );
}
