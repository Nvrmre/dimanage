import React from 'react';

const TABS = [
  { id: 'weekly', label: 'Mingguan' },
  { id: 'monthly', label: 'Bulanan' }
];

export default function SummaryTabs({ view, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="Filter ringkasan">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={view === t.id}
          className={'tab' + (view === t.id ? ' tab-active' : '')}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
