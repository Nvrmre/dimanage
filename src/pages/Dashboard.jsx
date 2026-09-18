import React, { useCallback, useEffect, useState } from 'react';
import { todayWIB, monthStart, addDays, addMonths, formatDateID, monthLabelID, compactLabel } from '../utils/index.js';
import { getSummary, getTransactions, saveTransaction, deleteTransaction } from '../api/client.js';
import CalendarGrid from '../components/CalendarGrid.jsx';
import SummaryCard from '../components/SummaryCard.jsx';
import Charts from '../components/Charts.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import DayDetailModal from '../components/DayDetailModal.jsx';

const emptyForm = (date) => ({ date, income: '', daily_expense: '', expense_note: '' });

export default function Dashboard({ user, onLogout }) {
  const today = todayWIB();
  const [month, setMonth] = useState(monthStart(today).slice(0, 7));
  const [selDate, setSelDate] = useState(null); // null = tidak ada detail dibuka

  const [todaySum, setTodaySum] = useState(null);
  const [summary, setSummary] = useState(null);
  const [txs, setTxs] = useState([]);
  const [weeklyExps, setWeeklyExps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tSum, mSum, txData] = await Promise.all([
        getSummary('daily', { date: today }),
        getSummary('monthly', { month }),
        getTransactions({ from: month + '-01', to: lastDayOfMonth(month) })
      ]);
      setTodaySum(tSum);
      setSummary(mSum);
      setTxs(txData.transactions || []);
      setWeeklyExps(txData.weekly_expenses || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [today, month]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openForm = (initial) => {
    setFormInitial(initial);
    setFormOpen(true);
  };

  const todayTx = txs.find((t) => t.date === today) || null;
  const selTx = selDate ? txs.find((t) => t.date === selDate) || null : null;
  const selRow = summary && summary.rows ? summary.rows.find((r) => r.date === selDate) : null;

  const handleSubmit = async (body, id) => {
    await saveTransaction(body, id);
    setFormOpen(false);
    await loadAll();
  };

  const handleDelete = async (id) => {
    await deleteTransaction(id);
    setFormOpen(false);
    await loadAll();
  };

  const nav = (dir) => {
    setMonth((m) => addMonths(m + '-01', dir).slice(0, 7));
  };

  const onCellClick = (date) => {
    setSelDate(date === selDate ? null : date); // toggle
  };

  const closeDetail = () => setSelDate(null);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">Dimanage</div>
        <div className="topbar-user">
          <span className="topbar-name">{user.name || 'User'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Keluar</button>
        </div>
      </header>

      <main className="container">
        {todaySum && (
          <section className="today-card">
            <div className="today-info">
              <p className="today-title">Hari Ini · {formatDateID(today, true).hari}</p>
              <div className="today-nums">
                <span className="pos">Masuk {compactLabel(todaySum.income)}</span>
                <span className="neg">Keluar {compactLabel(todaySum.total_expense)}</span>
                <span className={todaySum.net >= 0 ? 'pos strong' : 'neg strong'}>
                  Laba {compactLabel(todaySum.net)}
                </span>
              </div>
              {!todaySum.has_report && <p className="today-hint">Belum ada laporan hari ini.</p>}
            </div>
            <button
              className="btn btn-oncard"
              onClick={() => openForm(todayTx ? { ...todayTx } : emptyForm(today))}
            >
              {todayTx ? 'Edit Hari Ini' : '+ Input Hari Ini'}
            </button>
          </section>
        )}

        <div className="period-nav">
          <button className="btn btn-ghost" aria-label="Sebelumnya" onClick={() => nav(-1)}>‹</button>
          <span className="period-label">{monthLabelID(month)}</span>
          <button className="btn btn-ghost" aria-label="Berikutnya" onClick={() => nav(1)}>›</button>
        </div>

        {error && <div className="alert-error">{error}</div>}
        {loading && <div className="loading-inline">Memuat data…</div>}

        {!loading && summary && (
          <>
            <SummaryCard
              income={summary.total_income}
              expense={summary.total_expense}
              net={summary.total_net}
              extra={`Hari tercatat: ${summary.active_days}`}
            />
            <CalendarGrid
              month={month}
              gridStart={summary.grid_start}
              gridEnd={summary.grid_end}
              rowsByDate={new Map(summary.rows.map((r) => [r.date, r]))}
              selected={selDate}
              today={today}
              onSelect={onCellClick}
            />
            <Charts rows={summary.rows} weeklyExps={weeklyExps} txs={txs} />
          </>
        )}

        {selDate && selRow && (
          <DayDetailModal
            date={selDate}
            summary={selRow}
            tx={selTx}
            onClose={closeDetail}
            onEdit={() => {
              openForm(selTx ? { ...selTx } : emptyForm(selDate));
              closeDetail();
            }}
          />
        )}
      </main>

      {formOpen && (
        <TransactionForm
          initial={formInitial}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}