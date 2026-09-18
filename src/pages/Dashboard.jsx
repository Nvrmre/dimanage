import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { todayWIB, monthStart, weekStart, addDays, addMonths, formatDateID, monthLabelID, compactLabel } from '../utils/index.js';
import { getSummary, getTransactions, saveTransaction, deleteTransaction } from '../api/client.js';
import SummaryTabs from '../components/SummaryTabs.jsx';
import CalendarGrid from '../components/CalendarGrid.jsx';
import DailyDetail from '../components/DailyDetail.jsx';
import WeeklyView from '../components/WeeklyView.jsx';
import SummaryCard from '../components/SummaryCard.jsx';
import Charts from '../components/Charts.jsx';
import TransactionForm from '../components/TransactionForm.jsx';

export default function Dashboard({ user, onLogout }) {
  const today = todayWIB();
  // Default sesuai PRD v1.4: Bulanan
  const [view, setView] = useState('monthly');
  const [month, setMonth] = useState(monthStart(today).slice(0, 7));
  const [week, setWeek] = useState(weekStart(today));
  const [selDate, setSelDate] = useState(today);

  const [summary, setSummary] = useState(null);
  const [txs, setTxs] = useState([]);       // transaksi bulan berjalan (charts + edit)
  const [weeklyExps, setWeeklyExps] = useState([]);
  const [dayTxs, setDayTxs] = useState([]); // transaksi tanggal terpilih
  const [todaySum, setTodaySum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasks = [
        getSummary('daily', { date: today }),
        getSummary('monthly', { month }),
        getTransactions({ from: month + '-01', to: lastDayOfMonth(month) }),
        getSummary(view, viewParams(view, { month, week, date: selDate }))
      ];
      const [tSum, mSum, txData, viewSum] = await Promise.all(tasks);
      setTodaySum(tSum);
      setSummary(viewSum);
      setTxs(txData.transactions || []);
      setWeeklyExps(txData.weekly_expenses || []);
      // transaksi untuk tanggal terpilih (untuk edit/delete)
      const dTx = (txData.transactions || []).filter((t) => t.date === (view === 'daily' ? viewSum.date : selDate));
      setDayTxs(dTx);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [today, month, week, view, selDate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openForm = (initial = null) => {
    setFormInitial(initial);
    setFormOpen(true);
  };

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

  const rowsByDate = useMemo(() => {
    const m = new Map();
    if (summary && summary.rows) for (const r of summary.rows) m.set(r.date, r);
    return m;
  }, [summary]);

  const changeView = (v) => {
    setView(v);
    if (v === 'weekly') setWeek(weekStart(selDate || today));
  };

  const nav = (dir) => {
    if (view === 'monthly') setMonth((m) => addMonths(m + '-01', dir).slice(0, 7));
    if (view === 'weekly') setWeek((w) => addDays(w, 7 * dir));
    if (view === 'daily') {
      const d = addDays(selDate, dir);
      setSelDate(d);
      if (d.slice(0, 7) !== month) setMonth(d.slice(0, 7));
    }
  };

  const navLabel = () => {
    if (view === 'monthly') return monthLabelID(month);
    if (view === 'weekly') {
      const we = addDays(week, 6);
      const a = formatDateID(week).label, b = formatDateID(we).label;
      return `${a} – ${b}`;
    }
    return formatDateID(selDate, true).label;
  };

  const activeDate = view === 'daily' ? (summary ? summary.date : selDate) : selDate;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">📊 <span>Dimanage</span></div>
        <div className="topbar-user">
          <span className="topbar-name">{user.name || 'User'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Keluar</button>
        </div>
      </header>

      <main className="container">
        {/* Hari ini */}
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
            <button className="btn btn-primary" onClick={() => {
              const t = dayTxsOf(todaySum, txs);
              openForm(t[0] ? { ...t[0] } : { date: today, income: '', daily_expense: '', expense_note: '' });
            }}>
              {todaySum.has_report ? 'Edit' : '+ Input'}
            </button>
          </section>
        )}

        {/* Filter Harian / Mingguan / Bulanan */}
        <SummaryTabs view={view} onChange={changeView} />

        {/* Navigasi periode */}
        <div className="period-nav">
          <button className="btn btn-ghost" aria-label="Sebelumnya" onClick={() => nav(-1)}>‹</button>
          <span className="period-label">{navLabel()}</span>
          <button className="btn btn-ghost" aria-label="Berikutnya" onClick={() => nav(1)}>›</button>
        </div>

        {error && <div className="alert-error">{error}</div>}
        {loading && <div className="loading-inline">Memuat data…</div>}

        {!loading && summary && (
          <>
            {view === 'monthly' && (
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
                  rowsByDate={rowsByDate}
                  selected={selDate}
                  today={today}
                  onSelect={(d) => setSelDate(d)}
                />
                <DailyDetail
                  summary={summary.rows.find((r) => r.date === selDate)}
                  date={selDate}
                  tx={dayTxs[0] || null}
                  onEdit={() => {
                    const t = dayTxs[0];
                    openForm(t ? { ...t } : { date: selDate, income: '', daily_expense: '', expense_note: '' });
                  }}
                />
              </>
            )}

            {view === 'weekly' && (
              <WeeklyView
                summary={summary}
                today={today}
                onSelectDay={(d) => { setSelDate(d); setView('daily'); }}
              />
            )}

            {view === 'daily' && (
              <DailyDetail
                summary={summary}
                date={summary.date}
                tx={dayTxs[0] || null}
                onEdit={() => {
                  const t = dayTxs[0];
                  openForm(t ? { ...t } : { date: summary.date, income: '', daily_expense: '', expense_note: '' });
                }}
              />
            )}

            <Charts rows={summary.rows || summary.days || []} weeklyExps={weeklyExps} txs={txs} visible={view === 'monthly'} />
          </>
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

function viewParams(v, { month, week, date }) {
  if (v === 'monthly') return { month };
  if (v === 'weekly') return { date: week };
  return { date };
}

function dayTxsOf(todaySum, txs) {
  return txs.filter((t) => t.date === todaySum.date);
}
