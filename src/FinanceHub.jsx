import { useMemo, useState } from 'react';
import { calculateFarmerTrust } from './lib/farmer-trust';
import './FinanceBudget.css';

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

function FinanceEntryDialog({ onClose, onSave, budgets }) {
  const [type, setType] = useState('income');
  const [draft, setDraft] = useState({ date: currentDate(), budgetId: '' });

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
      ...(draft.budgetId ? { budgetId: draft.budgetId } : {}),
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
          {budgets.length > 0 && <label>Season budget <span>(optional)</span>
            <select value={draft.budgetId} onChange={(event) => setDraft((current) => ({ ...current, budgetId: event.target.value }))}>
              <option value="">Not linked to a budget</option>
              {budgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.title} · {budget.crop}</option>)}
            </select>
          </label>}
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

function SeasonBudgetDialog({ fields, onClose, onSave }) {
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({
    title: '',
    fieldId: '',
    crop: '',
    areaAcres: '',
    expectedYieldKg: '',
    targetPricePerKg: '',
    startDate: '',
    endDate: '',
    plannedCosts: [
      { category: 'Seeds', amount: '' },
      { category: 'Fertilizer', amount: '' },
      { category: 'Labor', amount: '' },
      { category: 'Transport', amount: '' },
    ],
  });

  const submit = (event) => {
    event.preventDefault();
    if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) {
      setError('Season end date must be on or after the start date.');
      return;
    }
    if (draft.plannedCosts.some((item) => item.amount && (!Number.isFinite(Number(item.amount)) || Number(item.amount) < 0))) {
      setError('Enter a valid non-negative amount for each planned cost.');
      return;
    }
    setError('');
    const plannedCosts = draft.plannedCosts
      .filter((item) => item.category.trim() && Number(item.amount) > 0)
      .map((item) => ({ category: item.category.trim(), amount: Number(item.amount) }));
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) return;
    onSave({
      id: createEntryId(),
      title: draft.title.trim(),
      fieldId: draft.fieldId,
      crop: draft.crop.trim(),
      areaAcres: Number(draft.areaAcres) || 0,
      expectedYieldKg: Number(draft.expectedYieldKg) || 0,
      targetPricePerKg: Number(draft.targetPricePerKg) || 0,
      startDate: draft.startDate,
      endDate: draft.endDate,
      plannedCosts,
      createdAt: new Date().toISOString(),
      source: 'farmer-entered planning assumptions',
    });
    onClose();
  };

  return (
    <div className="finance-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="finance-dialog finance-budget-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-budget-dialog-title">
        <div className="finance-dialog-heading"><div><span className="finance-eyebrow">FARM PLANNING</span><h2 id="finance-budget-dialog-title">Create an enterprise budget</h2></div><button type="button" className="finance-icon-button" aria-label="Close dialog" onClick={onClose}><span className="material-symbols-outlined">close</span></button></div>
        <p className="finance-budget-disclaimer">Enter your own assumptions. Cost and revenue estimates are not local price advice or a guaranteed yield or profit.</p>
        {error && <p className="finance-budget-error" role="alert">{error}</p>}
        <form onSubmit={submit}>
          <label>Budget name<input required maxLength={100} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. 2026 sunflower season" /></label>
          <label>Crop or livestock enterprise<input required maxLength={80} value={draft.crop} onChange={(event) => setDraft((current) => ({ ...current, crop: event.target.value }))} placeholder="e.g. Maize, dairy cattle, or layers" /></label>
          {fields.length > 0 && <label>Linked field (optional)<select value={draft.fieldId} onChange={(event) => {
            const field = fields.find((item) => item.id === event.target.value);
            setDraft((current) => ({ ...current, fieldId: event.target.value, crop: current.crop || field?.crop || '', areaAcres: current.areaAcres || String(field?.area || '') }));
          }}><option value="">No field selected</option>{fields.map((field) => <option value={field.id} key={field.id}>{field.name}{field.crop ? ` · ${field.crop}` : ''}</option>)}</select></label>}
          <label>Area (acres)<input type="number" min="0" step="any" value={draft.areaAcres} onChange={(event) => setDraft((current) => ({ ...current, areaAcres: event.target.value }))} /></label>
          <label>Planned output (kg, liters, eggs…)<input type="number" min="0" step="any" value={draft.expectedYieldKg} onChange={(event) => setDraft((current) => ({ ...current, expectedYieldKg: event.target.value }))} /></label>
          <label>Target sale price per unit (TZS)<input type="number" min="0" step="any" value={draft.targetPricePerKg} onChange={(event) => setDraft((current) => ({ ...current, targetPricePerKg: event.target.value }))} /></label>
          <label>Season start<input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label>Season end<input type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
          <div className="finance-budget-costs">
            <span>Planned costs (TZS)</span>
            {draft.plannedCosts.map((item, index) => <div key={index}><input aria-label={`Planned cost ${index + 1} category`} maxLength={60} value={item.category} onChange={(event) => setDraft((current) => ({ ...current, plannedCosts: current.plannedCosts.map((cost, costIndex) => costIndex === index ? { ...cost, category: event.target.value } : cost) }))} placeholder="Category" /><input aria-label={`Planned cost ${index + 1} amount`} type="number" min="0" step="1" value={item.amount} onChange={(event) => setDraft((current) => ({ ...current, plannedCosts: current.plannedCosts.map((cost, costIndex) => costIndex === index ? { ...cost, amount: event.target.value } : cost) }))} placeholder="Amount" /></div>)}
            <button type="button" onClick={() => setDraft((current) => ({ ...current, plannedCosts: [...current.plannedCosts, { category: '', amount: '' }] }))}>Add cost category</button>
          </div>
          <div className="finance-dialog-actions"><button type="button" className="finance-secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="finance-primary-button">Save season budget</button></div>
        </form>
      </section>
    </div>
  );
}

export default function FinanceHub({ profile, records, onRecordsChange, onNavigate, search = '', syncStatus = 'loading' }) {
  const [showEntry, setShowEntry] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [period, setPeriod] = useState('year');
  const budgets = records.budgets || [];
  const [selectedBudgetId, setSelectedBudgetId] = useState(budgets[0]?.id || '');
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
  const selectedBudget = budgets.find((budget) => budget.id === selectedBudgetId) || budgets[0];
  const budgetEntries = selectedBudget
    ? allEntries.filter((entry) => entry.budgetId === selectedBudget.id
      && (!selectedBudget.startDate || entry.date >= selectedBudget.startDate)
      && (!selectedBudget.endDate || entry.date <= selectedBudget.endDate))
    : [];
  const actualBudgetIncome = budgetEntries.filter((entry) => entry.type === 'income').reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const actualBudgetExpenses = budgetEntries.filter((entry) => entry.type === 'expense').reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const plannedBudgetCosts = (selectedBudget?.plannedCosts || []).reduce((total, item) => total + Number(item.amount || 0), 0);
  const estimatedRevenue = Number(selectedBudget?.expectedYieldKg || 0) * Number(selectedBudget?.targetPricePerKg || 0);
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
      {showEntry && <FinanceEntryDialog budgets={budgets} onClose={() => setShowEntry(false)} onSave={addEntry} />}
      {showBudget && <SeasonBudgetDialog fields={records.fields} onClose={() => setShowBudget(false)} onSave={(budget) => {
        onRecordsChange('budgets', [...budgets, budget]);
        setSelectedBudgetId(budget.id);
      }} />}
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
          <div className="finance-kpi-label"><span className="material-symbols-outlined">verified_user</span>Profile completeness</div>
          <strong>{trustScore}<small>/ 1,000</small></strong>
          <div className="finance-trust-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(trustScore) / 10 || 0))}%` }} /></div>
          <small>Based on your saved profile details</small>
        </article>
      </section>

      <section className="finance-card finance-season-budget">
        <div className="finance-spending-heading">
          <div><span className="finance-eyebrow">HESABU YA MSIMU</span><h2>Season budget &amp; actuals</h2><p>Plan costs and record season-linked sales and expenses to compare your own assumptions with actual entries.</p></div>
          <div className="finance-budget-heading-actions">
            {budgets.length > 0 && <label className="finance-period-select"><span className="sr-only">Select season budget</span><select value={selectedBudget?.id || ''} onChange={(event) => setSelectedBudgetId(event.target.value)}>{budgets.map((budget) => <option value={budget.id} key={budget.id}>{budget.title} · {budget.crop}</option>)}</select></label>}
            <button type="button" className="finance-primary-button" onClick={() => setShowBudget(true)}><span className="material-symbols-outlined">add</span>New season budget</button>
          </div>
        </div>
        {selectedBudget ? (
          <>
            <div className="finance-budget-metrics">
              <article><span>Planned costs</span><strong>{money(plannedBudgetCosts)}</strong></article>
              <article><span>Revenue estimate</span><strong>{money(estimatedRevenue)}</strong></article>
              <article><span>Recorded actual costs</span><strong>{money(actualBudgetExpenses)}</strong></article>
              <article><span>Recorded actual net</span><strong>{money(actualBudgetIncome - actualBudgetExpenses)}</strong></article>
            </div>
            <div className="finance-budget-context"><strong>{selectedBudget.title} · {selectedBudget.crop}</strong>{selectedBudget.areaAcres > 0 && <span>{Number(selectedBudget.areaAcres).toLocaleString()} acres</span>}{selectedBudget.startDate && <span>{selectedBudget.startDate}{selectedBudget.endDate ? ` – ${selectedBudget.endDate}` : ''}</span>}</div>
            <p className="finance-budget-disclaimer">Estimates use only your entered yield, price and cost assumptions. Revenue and net values are planning scenarios, not forecasts or guarantees. Actuals include only finance records explicitly linked to this budget and within its dates.</p>
            <div className="finance-budget-cost-table">
              {(selectedBudget.plannedCosts || []).length ? (selectedBudget.plannedCosts || []).map((item, index) => {
                const actual = budgetEntries.filter((entry) => entry.type === 'expense' && entry.category.toLowerCase() === item.category.toLowerCase())
                  .reduce((total, entry) => total + Number(entry.amount || 0), 0);
                return <div key={`${item.category}-${index}`}><span>{item.category}</span><strong>Plan {money(item.amount)}</strong><small>Actual {money(actual)}</small></div>;
              }) : <p>No planned cost categories entered for this budget.</p>}
            </div>
            <button type="button" className="finance-outline-button" onClick={() => setShowEntry(true)}>Record linked income or expense <span className="material-symbols-outlined">arrow_forward</span></button>
          </>
        ) : <div className="finance-empty-inline"><span className="material-symbols-outlined">event_note</span><p>Create a season budget using your own yield, target price and planned costs. No external benchmarks are assumed.</p></div>}
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
