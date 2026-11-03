import { useMemo, useState } from 'react';
import { calculateFarmerTrust } from './lib/farmer-trust';

const money = (amount) => `TZS ${Math.round(Number(amount) || 0).toLocaleString('en-TZ')}`;
const currentDate = () => new Date().toISOString().slice(0, 10);

function createEntryId() {
  return globalThis.crypto?.randomUUID?.() || `finance-${Date.now()}`;
}

function exportLedger(entries) {
  const rows = [
    ['Type', 'Date', 'Category', 'Amount (TZS)', 'Note'],
    ...entries.map((entry) => [
      entry.type === 'expense' ? 'Expense' : 'Income',
      entry.date || '',
      entry.category || entry.crop || '',
      Number(entry.amount) || 0,
      entry.note || '',
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `hesabu-yangu-${currentDate()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function monthKey(date) {
  return String(date || '').slice(0, 7);
}

function FinanceEntryDialog({ onClose, onSave }) {
  const [type, setType] = useState('income');
  const [draft, setDraft] = useState({ date: currentDate() });

  const save = (event) => {
    event.preventDefault();
    const category = String(draft.category || '').trim();
    const amount = Number(draft.amount);
    if (!category || !Number.isFinite(amount) || amount <= 0) return;
    onSave({
      id: createEntryId(),
      type,
      amount,
      category,
      ...(type === 'income' ? { crop: category } : {}),
      date: draft.date || currentDate(),
      note: String(draft.note || '').trim(),
    });
    onClose();
  };

  return (
    <div className="finance-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="finance-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-dialog-title">
        <div className="finance-dialog-heading">
          <div><span className="finance-eyebrow">HESABU YANGU</span><h2 id="finance-dialog-title">New entry</h2></div>
          <button type="button" className="finance-icon-button" aria-label="Close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="finance-entry-switch" role="group" aria-label="Entry type">
          <button type="button" className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>Income</button>
          <button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>Expense</button>
        </div>
        <form onSubmit={save}>
          <label>{type === 'income' ? 'Income source or produce' : 'Expense category'}
            <input autoFocus required value={draft.category || ''} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder={type === 'income' ? 'e.g. Maize sales' : 'e.g. Seeds and fertilizer'} />
          </label>
          <label>Amount (TZS)
            <input required type="number" min="1" step="1" value={draft.amount || ''} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} />
          </label>
          <label>Date
            <input required type="date" value={draft.date || currentDate()} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
          </label>
          <label>Note <span>(optional)</span>
            <textarea rows="3" value={draft.note || ''} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Buyer, supplier, or other details" />
          </label>
          <div className="finance-dialog-actions">
            <button type="button" className="finance-secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="finance-primary-button">Save {type}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function FinanceHub({ profile, records, onRecordsChange, onNavigate, search = '', syncStatus = 'loading' }) {
  const [showEntry, setShowEntry] = useState(false);
  const [period, setPeriod] = useState('year');
  const now = new Date();
  const year = now.getFullYear();
  const expenses = records.expenses || [];
  const allEntries = useMemo(() => [
    ...records.income.map((entry) => ({ ...entry, type: 'income', category: entry.category || entry.crop || 'Farm income' })),
    ...expenses.map((entry) => ({ ...entry, type: 'expense', category: entry.category || 'Farm expense' })),
  ].sort((left, right) => String(right.date || '').localeCompare(String(left.date || ''))), [expenses, records.income]);

  const periodStart = period === 'year' ? `${year}-01` : `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periodEnd = monthKey(currentDate());
  const entriesInPeriod = allEntries.filter((entry) => monthKey(entry.date) >= periodStart && monthKey(entry.date) <= periodEnd);
  const income = entriesInPeriod.filter((entry) => entry.type === 'income').reduce((total, entry) => total + (Number(entry.amount) || 0), 0);
  const expense = entriesInPeriod.filter((entry) => entry.type === 'expense').reduce((total, entry) => total + (Number(entry.amount) || 0), 0);
  const trustScore = calculateFarmerTrust(profile).score;
  const filteredEntries = allEntries.filter((entry) => {
    const query = search.trim().toLowerCase();
    return !query || `${entry.category} ${entry.note || ''} ${entry.type}`.toLowerCase().includes(query);
  });
  const chartMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, now.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthEntries = allEntries.filter((entry) => monthKey(entry.date) === key);
    return {
      key,
      label: date.toLocaleDateString('en', { month: 'short' }),
      income: monthEntries.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
      expense: monthEntries.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    };
  });
  const chartMax = Math.max(1, ...chartMonths.flatMap((month) => [month.income, month.expense]));
  const incomeBySource = Object.entries(entriesInPeriod.filter((entry) => entry.type === 'income').reduce((sources, entry) => {
    sources[entry.category] = (sources[entry.category] || 0) + Number(entry.amount || 0);
    return sources;
  }, {})).sort((left, right) => right[1] - left[1]).slice(0, 4);
  const expenseByCategory = Object.entries(entriesInPeriod.filter((entry) => entry.type === 'expense').reduce((categories, entry) => {
    categories[entry.category] = (categories[entry.category] || 0) + Number(entry.amount || 0);
    return categories;
  }, {})).sort((left, right) => right[1] - left[1]).slice(0, 4);
  const loanRequests = records.requests.filter((record) => record.module === 'loans' || record.module === 'smart-loan');
  const insuranceRequests = records.requests.filter((record) => record.module === 'insurance');
  const syncCopy = {
    loading: 'Checking record sync',
    pending: 'Changes waiting to sync',
    syncing: 'Syncing your finance records',
    synced: 'Finance records synced',
    offline: 'Offline · saved on this device',
  }[syncStatus] || 'Finance records saved on this device';

  const addEntry = (entry) => {
    const key = entry.type === 'expense' ? 'expenses' : 'income';
    onRecordsChange(key, [...(records[key] || []), entry]);
  };

  return (
    <main className="finance-hub" aria-label="Hesabu Yangu finance dashboard">
      {showEntry && <FinanceEntryDialog onClose={() => setShowEntry(false)} onSave={addEntry} />}
      <div className="finance-page-heading">
        <div><span className="finance-eyebrow">FINANCE &amp; TRUST</span><h1>Hesabu Yangu</h1><p>Your farm income, expenses, and financial records in one place.</p></div>
        <div className="finance-heading-actions">
          <span className={`finance-sync-status ${syncStatus === 'synced' ? 'is-synced' : ''}`} role="status"><span />{syncCopy}</span>
          <button type="button" className="finance-secondary-button" onClick={() => exportLedger(allEntries)}><span className="material-symbols-outlined">download</span>Export report</button>
          <button type="button" className="finance-primary-button" onClick={() => setShowEntry(true)}><span className="material-symbols-outlined">add</span>New entry</button>
        </div>
      </div>

      <section className="finance-kpi-grid" aria-label="Financial summary">
        <article className="finance-card finance-kpi-card">
          <div className="finance-kpi-label"><span className="material-symbols-outlined">payments</span>Recorded income <span className="finance-period-label">{period === 'year' ? year : 'This month'}</span></div>
          <strong>{money(income)}</strong><small>From your saved sales records</small>
        </article>
        <article className="finance-card finance-kpi-card">
          <div className="finance-kpi-label"><span className="material-symbols-outlined">receipt_long</span>Recorded expenses <span className="finance-period-label">{period === 'year' ? year : 'This month'}</span></div>
          <strong>{money(expense)}</strong><small>From your saved farm costs</small>
        </article>
        <article className="finance-card finance-kpi-card finance-kpi-profit">
          <div className="finance-kpi-label"><span className="material-symbols-outlined">account_balance</span>Income after expenses</div>
          <strong>{money(income - expense)}</strong><small>Based on recorded entries, not a forecast</small>
        </article>
        <article className="finance-card finance-trust-card">
          <span className="finance-trust-watermark material-symbols-outlined">verified_user</span>
          <div className="finance-kpi-label"><span className="material-symbols-outlined">verified_user</span>Farmer trust score</div>
          <strong>{trustScore}<small>/ 1,000</small></strong>
          <div className="finance-trust-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(trustScore) / 10 || 0))}%` }} /></div>
          <small>Based on your saved profile details</small>
        </article>
      </section>

      <section className="finance-primary-grid">
        <article className="finance-card finance-chart-card">
          <div className="finance-card-heading">
            <div><span className="finance-eyebrow">CASH FLOW</span><h2>Income &amp; expenses</h2></div>
            <label className="finance-period-select"><span className="sr-only">Summary period</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="year">This year</option><option value="month">This month</option></select></label>
          </div>
          <div className="finance-chart-legend"><span><i className="income-dot" />Income</span><span><i className="expense-dot" />Expenses</span></div>
          <div className="finance-bar-chart" role="img" aria-label="Monthly recorded income and expense comparison for the last six months">
            {chartMonths.map((month) => (
              <div className="finance-chart-month" key={month.key}>
                <div className="finance-chart-bars">
                  <span className="finance-bar income-bar" title={`Income ${money(month.income)}`} style={{ height: `${month.income ? Math.max(4, month.income / chartMax * 100) : 2}%` }} />
                  <span className="finance-bar expense-bar" title={`Expenses ${money(month.expense)}`} style={{ height: `${month.expense ? Math.max(4, month.expense / chartMax * 100) : 2}%` }} />
                </div>
                <span>{month.label}</span>
              </div>
            ))}
          </div>
          <div className="finance-source-list">
            <div className="finance-source-heading">Income source <span>Recorded total</span></div>
            {incomeBySource.length ? incomeBySource.map(([source, amount]) => (
              <div className="finance-source-row" key={source}><span><i />{source}</span><strong>{money(amount)}</strong></div>
            )) : <p className="finance-inline-empty">Record a sale to see your income breakdown.</p>}
          </div>
        </article>

        <article className="finance-card finance-loan-card">
          <div className="finance-card-heading"><div><span className="finance-eyebrow">FINANCING</span><h2>Benki ya Shambani</h2></div><span className="material-symbols-outlined finance-card-icon">account_balance_wallet</span></div>
          <div className="finance-loan-summary">
            <span>Saved loan applications</span>
            <strong>{loanRequests.length}</strong>
            <p>{loanRequests.length ? 'These are application records, not confirmed active balances.' : 'No loan application or active balance is recorded here yet.'}</p>
            <div className="finance-loan-divider" />
            <small>Active repayments and interest are not connected to this account.</small>
          </div>
          <button type="button" className="finance-outline-button" onClick={() => onNavigate('smart-loan')}>Explore Smart Loans <span className="material-symbols-outlined">arrow_forward</span></button>
        </article>
      </section>

      <section className="finance-card finance-spending-card">
        <div className="finance-spending-heading">
          <div><span className="finance-eyebrow">FARM INPUTS &amp; COSTS</span><h2>Spending overview</h2><p>Expense categories from your saved records for {period === 'year' ? year : 'this month'}.</p></div>
          <button type="button" className="finance-primary-button" onClick={() => setShowEntry(true)}><span className="material-symbols-outlined">add</span>Record expense</button>
        </div>
        {expenseByCategory.length ? (
          <div className="finance-table-wrap"><table className="finance-table">
            <thead><tr><th>Expense category</th><th>Recorded total</th><th>Share of expenses</th></tr></thead>
            <tbody>{expenseByCategory.map(([category, amount]) => (
              <tr key={category}><td><span className="material-symbols-outlined">eco</span>{category}</td><td>{money(amount)}</td><td><div className="finance-share"><span><i style={{ width: `${expense ? amount / expense * 100 : 0}%` }} /></span><small>{expense ? Math.round(amount / expense * 100) : 0}%</small></div></td></tr>
            ))}</tbody>
          </table></div>
        ) : <div className="finance-empty-inline"><span className="material-symbols-outlined">receipt_long</span><p>No expenses recorded for this period. Add farm costs to see your spending overview.</p></div>}
      </section>

      <section className="finance-bottom-grid">
        <article className="finance-insurance-card">
          <div className="finance-insurance-icon"><span className="material-symbols-outlined">health_and_safety</span></div>
          <div><span className="finance-eyebrow">RISK PROTECTION</span><h2>Crop micro-insurance</h2><p>{insuranceRequests.length ? `${insuranceRequests.length} saved insurance request${insuranceRequests.length === 1 ? '' : 's'}. Policy approval and coverage details are not confirmed here.` : 'No insurance policy is linked to your finance records yet.'}</p><button type="button" onClick={() => onNavigate('insurance')}>{insuranceRequests.length ? 'View insurance requests' : 'Explore insurance'} <span className="material-symbols-outlined">arrow_forward</span></button></div>
        </article>
        <article className="finance-card finance-tax-card">
          <div className="finance-tax-heading"><div className="finance-tax-icon"><span className="material-symbols-outlined">account_balance</span></div><div><span className="finance-eyebrow">RECORD SUMMARY</span><h2>Tax &amp; TRA records</h2></div></div>
          <div className="finance-tax-row"><span>Recorded income</span><strong>{money(income)}</strong></div>
          <div className="finance-tax-row"><span>Recorded expenses</span><strong>{money(expense)}</strong></div>
          <p>Planning summary only. Taxable income, VAT, and filing status are not calculated or verified.</p>
          <button type="button" onClick={() => exportLedger(allEntries)}>Download ledger <span className="material-symbols-outlined">download</span></button>
        </article>
      </section>

      <section className="finance-card finance-ledger-card">
        <div className="finance-card-heading"><div><span className="finance-eyebrow">YOUR RECORDS</span><h2>Recent transactions</h2></div><span className="finance-ledger-count">{filteredEntries.length}</span></div>
        {filteredEntries.length ? <div className="finance-table-wrap"><table className="finance-table finance-ledger-table">
          <thead><tr><th>Transaction</th><th>Date</th><th>Type</th><th>Amount</th></tr></thead>
          <tbody>{filteredEntries.slice(0, 8).map((entry) => (
            <tr key={`${entry.type}-${entry.id}`}><td><strong>{entry.category}</strong>{entry.note && <small>{entry.note}</small>}</td><td>{entry.date ? new Date(`${entry.date.slice(0, 10)}T00:00:00`).toLocaleDateString() : '—'}</td><td><span className={`finance-entry-badge ${entry.type}`}>{entry.type === 'income' ? 'Income' : 'Expense'}</span></td><td className={entry.type === 'income' ? 'finance-amount-in' : 'finance-amount-out'}>{entry.type === 'income' ? '+' : '−'}{money(entry.amount)}</td></tr>
          ))}</tbody>
        </table></div> : <div className="finance-empty-inline"><span className="material-symbols-outlined">account_balance_wallet</span><p>{search ? 'No finance records match your search.' : 'Your income and expense entries will appear here after you add them.'}</p><button type="button" className="finance-outline-button" onClick={() => setShowEntry(true)}>Add first entry</button></div>}
      </section>
    </main>
  );
}
