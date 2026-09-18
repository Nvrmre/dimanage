// Logika summary harian/mingguan/bulanan — murni fungsi, gampang dites.
//
// Prinsip PRD:
// - Laba bersih harian = income - (daily_expense + weekly_expense yang
//   dibebankan pada tanggal itu). Expense tidak boleh dihitung dua kali.
// - Laba mingguan = SUM(laba harian Senin..Minggu).
// - Laba bulanan = SUM(laba harian sebulan) = totalIncome - totalExpense.

/**
 * Gabungkan transaksi harian + weekly expenses per tanggal.
 * @param {Array} transactions  rows transactions (income, daily_expense)
 * @param {Array} weeklyExpenses rows weekly_expenses (expense_date, amount)
 * @returns {Map} dateStr → {income, daily_expense, weekly_expense}
 */
export function mergeByDate(transactions = [], weeklyExpenses = []) {
  const map = new Map();
  for (const t of transactions) {
    const cur = map.get(t.date) || { income: 0, daily_expense: 0, weekly_expense: 0, expense_note: null, has_report: false };
    cur.income += t.income || 0;
    cur.daily_expense += t.daily_expense || 0;
    if (t.expense_note) cur.expense_note = t.expense_note;
    cur.has_report = true;
    map.set(t.date, cur);
  }
  for (const w of weeklyExpenses) {
    const cur = map.get(w.expense_date) || { income: 0, daily_expense: 0, weekly_expense: 0, expense_note: null, has_report: false };
    cur.weekly_expense += w.amount || 0;
    map.set(w.expense_date, cur);
  }
  return map;
}

/**
 * Summary harian (1 tanggal): income, seluruh pengeluaran, laba bersih.
 */
export function dailySummary(map, dateStr) {
  const row = map.get(dateStr) || { income: 0, daily_expense: 0, weekly_expense: 0, has_report: false };
  const totalExpense = (row.daily_expense || 0) + (row.weekly_expense || 0);
  return {
    date: dateStr,
    income: row.income || 0,
    daily_expense: row.daily_expense || 0,
    weekly_expense: row.weekly_expense || 0,
    total_expense: totalExpense,
    net: (row.income || 0) - totalExpense,
    has_data: (row.income || 0) !== 0 || totalExpense !== 0,
    has_report: !!row.has_report,
    expense_note: row.expense_note || null
  };
}

/**
 * Summary mingguan: 7 hari Senin..Minggu + total.
 * @returns {{days: Array, total_net: number, total_income: number, total_expense: number}}
 */
export function weeklySummary(map, weekStartDate, dateRangeFn) {
  const days = [];
  let totalNet = 0, totalIncome = 0, totalExpense = 0;
  for (const d of dateRangeFn(weekStartDate, addDaysLocal(weekStartDate, 6))) {
    const s = dailySummary(map, d);
    days.push(s);
    totalNet += s.net;
    totalIncome += s.income;
    totalExpense += s.total_expense;
  }
  return { week_start: weekStartDate, days, total_net: totalNet, total_income: totalIncome, total_expense: totalExpense };
}

function addDaysLocal(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Summary bulanan: baris per tanggal sebulan penuh + agregat.
 * @param {string} monthStartStr 'YYYY-MM-01'
 * @param {(y:number,m:number)=>number} daysInMonthFn
 */
export function monthlySummary(map, monthStartStr, daysInMonthFn) {
  const y = Number(monthStartStr.slice(0, 4));
  const m = Number(monthStartStr.slice(5, 7));
  const nDays = daysInMonthFn(y, m);
  const rows = [];
  let totalIncome = 0, totalExpense = 0, activeDays = 0;
  for (let i = 1; i <= nDays; i++) {
    const ds = `${monthStartStr.slice(0, 8)}${String(i).padStart(2, '0')}`;
    const s = dailySummary(map, ds);
    rows.push(s);
    totalIncome += s.income;
    totalExpense += s.total_expense;
    if (s.has_data) activeDays++;
  }
  return {
    month: monthStartStr.slice(0, 7),
    rows,
    total_income: totalIncome,
    total_expense: totalExpense,
    total_net: totalIncome - totalExpense,
    active_days: activeDays
  };
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
