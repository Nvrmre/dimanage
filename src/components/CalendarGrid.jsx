import React from 'react';

const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/**
 * Calendar grid satu bulan (grid dimulai dari Senin sebelum/es tanggal 1).
 * Warna cell: profit = mint, loss = salmon, tanpa data = abu terang.
 */
export default function CalendarGrid({ gridStart, gridEnd, rowsByDate, selected, today, onSelect }) {
  const cells = [];
  let cur = gridStart;
  while (cur <= gridEnd) {
    cells.push(cur);
    const d = new Date(cur + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    cur = d.toISOString().slice(0, 10);
  }

  return (
    <section className="calendar card">
      <div className="calendar-head">
        {DAY_HEADERS.map((h) => <div key={h} className="calendar-dow">{h}</div>)}
      </div>
      <div className="calendar-grid">
        {cells.map((date) => {
          const row = rowsByDate.get(date);
          const inMonth = date.slice(0, 7) === gridStart.slice(0, 7) || date.slice(0, 7) === gridEnd.slice(0, 7) ?
            (date >= gridStart.slice(0, 7) + '-01' && date <= gridEnd.slice(0, 7) + '31') : true;
          const cls = [
            'calendar-cell',
            !row || !row.has_data ? 'cell-empty' : row.net > 0 ? 'cell-profit' : row.net < 0 ? 'cell-loss' : 'cell-flat',
            date === selected ? 'cell-selected' : '',
            date === today ? 'cell-today' : '',
            inMonth ? '' : 'cell-out'
          ].join(' ');
          return (
            <button key={date} className={cls} onClick={() => onSelect(date)} aria-label={date}>
              <span className="cell-date">{Number(date.slice(8, 10))}</span>
              <span className="cell-amount">
                {row && row.has_data ? shortRp(row.net) : '·'}
              </span>
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span><i className="dot dot-profit" /> Laba</span>
        <span><i className="dot dot-loss" /> Rugi</span>
        <span><i className="dot dot-empty" /> Belum ada data</span>
      </div>
    </section>
  );
}

function shortRp(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return sign + 'Rp' + trim(Number(abs / 1_000_000)) + 'jt';
  if (abs >= 1_000) return sign + 'Rp' + trim(Number(abs / 1_000)) + 'rb';
  return sign + 'Rp' + abs;
}
function trim(x) { return x.toFixed(1).replace('.0', ''); }
