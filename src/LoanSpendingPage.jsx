import { useEffect, useMemo, useState } from 'react';

const categories = [
  { id: 'seeds', label: 'Seeds & planting', icon: 'grass' },
  { id: 'soil', label: 'Fertilizer & soil', icon: 'compost' },
  { id: 'protection', label: 'Crop protection', icon: 'pest_control' },
  { id: 'labour', label: 'Farm labour', icon: 'groups' },
  { id: 'water', label: 'Irrigation & water', icon: 'water_drop' },
  { id: 'equipment', label: 'Equipment & tools', icon: 'build' },
  { id: 'logistics', label: 'Transport & storage', icon: 'local_shipping' },
];

const formatTzs = (amount) => `TZS ${Number(amount || 0).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const emptyData = () => ({ loans: [], expenses: [] });
const emptyLoanData = { loans: [], expenses: [] };
const createId = () => globalThis.crypto?.randomUUID?.() || `loan-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function readStoredData(storageKey) {
  if (!storageKey) {
    return { storageKey, data: emptyData(), error: 'Your account ID is unavailable; loan data will not persist in this browser.' };
  }
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    if (!saved) return { storageKey, data: emptyData(), error: '' };
    if (!Array.isArray(saved.loans) || !Array.isArray(saved.expenses)) {
      return { storageKey, data: emptyData(), error: 'Saved loan data is invalid. Reset local loan data to continue.' };
    }
    const loanIds = new Set();
    const validLoans = saved.loans.every((loan) => {
      if (!loan || typeof loan.id !== 'string' || !loan.id || loanIds.has(loan.id)
        || typeof loan.purpose !== 'string' || typeof loan.lender !== 'string'
        || !Number.isSafeInteger(loan.principal) || loan.principal <= 0
        || !Number.isInteger(loan.termMonths) || loan.termMonths < 1 || loan.termMonths > 60
        || (loan.trainingOptIn !== undefined && typeof loan.trainingOptIn !== 'boolean')
        || !isValidDate(loan.startDate) || !loan.allocations || typeof loan.allocations !== 'object') return false;
      loanIds.add(loan.id);
      return categories.every(({ id }) => Number.isSafeInteger(loan.allocations[id]) && loan.allocations[id] >= 0)
        && categories.reduce((total, { id }) => total + loan.allocations[id], 0) <= loan.principal;
    });
    const validExpenses = saved.expenses.every((entry) => entry && typeof entry.id === 'string'
      && typeof entry.note === 'string'
      && loanIds.has(entry.loanId) && categories.some(({ id }) => id === entry.category)
      && Number.isSafeInteger(entry.amount) && entry.amount > 0 && isValidDate(entry.date));
    if (!validLoans || !validExpenses) {
      return { storageKey, data: emptyData(), error: 'Saved loan data is invalid. Reset local loan data to continue.' };
    }
    return {
      storageKey,
      data: {
        loans: saved.loans,
        expenses: saved.expenses,
      },
      error: '',
    };
  } catch (error) {
    console.error('Loan planner data could not be read:', error);
    return { storageKey, data: emptyData(), error: 'Saved loan data could not be read. Reset local loan data to continue.' };
  }
}

function monthKey(date) {
  return String(date || '').slice(0, 7);
}

function monthLabel(date) {
  const [year, month] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-TZ', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function downloadFeedbackCsv(loan, expenses) {
  const grouped = new Map();
  expenses.filter((entry) => entry.loanId === loan.id).forEach((entry) => {
    const key = `${monthKey(entry.date)}|${entry.category}`;
    grouped.set(key, (grouped.get(key) || 0) + Number(entry.amount || 0));
  });

  const rows = [['month', 'category', 'recorded_spend_tzs']];
  [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).forEach(([key, amount]) => {
    const [month, categoryId] = key.split('|');
    const category = categories.find((item) => item.id === categoryId);
    if (category) rows.push([month, category.label, Math.round(amount)]);
  });
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `agrinest-spending-feedback-${today()}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function makeAllocationDraft() {
  return Object.fromEntries(categories.map(({ id }) => [id, '0']));
}

export default function LoanSpendingPage({ userId, onBack }) {
  const storageKey = userId ? `agrinest-loan-planner:v1:${userId}` : '';
  const [stored, setStored] = useState(() => readStoredData(storageKey));
  const [activeLoanId, setActiveLoanId] = useState('');
  const [loanDraft, setLoanDraft] = useState({ purpose: '', lender: '', principal: '', termMonths: '6', startDate: today() });
  const [allocationDraft, setAllocationDraft] = useState(makeAllocationDraft);
  const [editAllocationDraft, setEditAllocationDraft] = useState(makeAllocationDraft);
  const [expenseDraft, setExpenseDraft] = useState({ category: categories[0].id, amount: '', date: today(), note: '' });
  const [notice, setNotice] = useState('');
  const data = stored.storageKey === storageKey ? stored.data : emptyLoanData;
  const storageError = stored.storageKey === storageKey ? stored.error : '';

  useEffect(() => {
    setStored(readStoredData(storageKey));
    setActiveLoanId('');
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || stored.storageKey !== storageKey || storageError.startsWith('Saved loan data')) return;
    try {
      if (stored.data.loans.length || stored.data.expenses.length) {
        window.localStorage.setItem(storageKey, JSON.stringify(stored.data));
      } else {
        window.localStorage.removeItem(storageKey);
      }
      if (storageError) setStored((current) => ({ ...current, error: '' }));
    } catch (error) {
      console.error('Loan planner data could not be saved:', error);
      setStored((current) => ({ ...current, error: 'Could not save loan data on this device. Check available browser storage.' }));
    }
  }, [storageKey, stored.data, stored.storageKey, storageError]);

  const activeLoan = data.loans.find((loan) => loan.id === activeLoanId) || data.loans[0] || null;
  useEffect(() => {
    if (!activeLoan) {
      setEditAllocationDraft(makeAllocationDraft());
      return;
    }
    setEditAllocationDraft(Object.fromEntries(categories.map(({ id }) => [id, String(activeLoan.allocations?.[id] || 0)])));
  }, [activeLoan?.id]);
  const loanExpenses = useMemo(
    () => activeLoan ? data.expenses.filter((entry) => entry.loanId === activeLoan.id) : [],
    [activeLoan, data.expenses],
  );
  const totalAllocated = activeLoan
    ? categories.reduce((total, category) => total + Number(activeLoan.allocations?.[category.id] || 0), 0)
    : 0;
  const totalSpent = loanExpenses.reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const expensesByCategory = useMemo(() => loanExpenses.reduce((totals, entry) => {
    totals[entry.category] = (totals[entry.category] || 0) + Number(entry.amount || 0);
    return totals;
  }, {}), [loanExpenses]);

  const updateData = (updater) => {
    setStored((current) => {
      const base = current.storageKey === storageKey ? current : readStoredData(storageKey);
      return { ...base, data: updater(base.data) };
    });
    setNotice('');
  };

  const handleCreateLoan = (event) => {
    event.preventDefault();
    const principal = Number(loanDraft.principal);
    const termMonths = Number(loanDraft.termMonths);
    const allocations = Object.fromEntries(categories.map(({ id }) => [id, Number(allocationDraft[id] || 0)]));
    const allocated = Object.values(allocations).reduce((total, amount) => total + amount, 0);

    if (!Number.isSafeInteger(principal) || principal <= 0) {
      setNotice('Enter a whole-number loan amount greater than zero.');
      return;
    }
    if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 60) {
      setNotice('Choose a loan term from 1 to 60 months.');
      return;
    }
    if (Object.values(allocations).some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
      setNotice('Category allocations must be whole-number amounts of zero or more.');
      return;
    }
    if (allocated > principal) {
      setNotice('Your planned category allocations cannot exceed the loan amount.');
      return;
    }

    const loan = {
      id: createId(),
      purpose: loanDraft.purpose.trim(),
      lender: loanDraft.lender.trim(),
      principal,
      termMonths,
      startDate: loanDraft.startDate,
      allocations,
      trainingOptIn: false,
      createdAt: new Date().toISOString(),
    };
    updateData((data) => ({ ...data, loans: [loan, ...data.loans] }));
    setActiveLoanId(loan.id);
    setLoanDraft({ purpose: '', lender: '', principal: '', termMonths: '6', startDate: today() });
    setAllocationDraft(makeAllocationDraft());
    setNotice('Loan plan saved on this device. No lender or payment account was contacted.');
  };

  const handleLogExpense = (event) => {
    event.preventDefault();
    const amount = Number(expenseDraft.amount);
    if (!activeLoan) return;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setNotice('Enter a whole-number expense greater than zero.');
      return;
    }
    const expense = {
      id: createId(),
      loanId: activeLoan.id,
      category: expenseDraft.category,
      amount,
      date: expenseDraft.date,
      note: expenseDraft.note.trim(),
      createdAt: new Date().toISOString(),
    };
    updateData((data) => ({ ...data, expenses: [expense, ...data.expenses] }));
    setExpenseDraft((current) => ({ ...current, amount: '', note: '' }));
    setNotice('Expense recorded. This is a tracking entry only; AGRI-NEST does not move or block funds.');
  };

  const handleSaveAllocation = (event) => {
    event.preventDefault();
    if (!activeLoan) return;
    const allocations = Object.fromEntries(categories.map(({ id }) => [id, Number(editAllocationDraft[id] || 0)]));
    if (Object.values(allocations).some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
      setNotice('Category allocations must be whole-number amounts of zero or more.');
      return;
    }
    const allocated = Object.values(allocations).reduce((total, amount) => total + amount, 0);
    if (allocated > Number(activeLoan.principal)) {
      setNotice('Your planned category allocations cannot exceed the loan amount.');
      return;
    }
    updateData((data) => ({
      ...data,
      loans: data.loans.map((loan) => loan.id === activeLoan.id ? { ...loan, allocations } : loan),
    }));
    setNotice('Your category plan was updated. Existing expense records were not changed.');
  };

  const handleDeleteLoan = () => {
    if (!activeLoan || !window.confirm(`Delete “${activeLoan.purpose || 'this loan plan'}” and its local spending records?`)) return;
    updateData((data) => ({
      ...data,
      loans: data.loans.filter((loan) => loan.id !== activeLoan.id),
      expenses: data.expenses.filter((entry) => entry.loanId !== activeLoan.id),
    }));
    setActiveLoanId('');
    setNotice('Loan plan and its local spending records were deleted.');
  };

  const handleDownloadFeedback = () => {
    try {
      downloadFeedbackCsv(activeLoan, loanExpenses);
    } catch (error) {
      console.error('Opt-in spending export could not be created:', error);
      setNotice('Could not create the CSV download in this browser.');
    }
  };

  const handleResetLocalData = () => {
    if (!window.confirm('Delete all loan plans, expense records, and training consent saved for this account on this browser?')) return;
    try {
      if (storageKey) window.localStorage.removeItem(storageKey);
      setStored({ storageKey, data: emptyData(), error: '' });
    } catch (error) {
      console.error('Loan planner data could not be deleted:', error);
      setStored((current) => ({ ...current, error: 'Could not delete loan data from this browser.' }));
      return;
    }
    setActiveLoanId('');
    setNotice('All loan-planner data for this account was deleted from this browser.');
  };

  const schedule = activeLoan ? Array.from({ length: Number(activeLoan.termMonths) || 0 }, (_, index) => {
    const [year, month] = String(activeLoan.startDate || today()).slice(0, 7).split('-').map(Number);
    const date = new Date(year, month - 1 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const planned = totalAllocated / Number(activeLoan.termMonths);
    const actual = loanExpenses.filter((entry) => monthKey(entry.date) === key)
      .reduce((total, entry) => total + Number(entry.amount || 0), 0);
    return { key, label: monthLabel(key), planned, actual };
  }) : [];

  return (
    <main className="loan-planner">
      <header className="loan-planner-header">
        <button type="button" className="farmer-workspace-back" onClick={onBack}>
          <span className="material-symbols-outlined">arrow_back</span>Dashboard
        </button>
        <div className="loan-planner-title">
          <span className="farmer-workspace-eyebrow">FARM FINANCE · YOUR PLAN, YOUR CHOICE</span>
          <h1><span className="material-symbols-outlined">account_balance_wallet</span>Loan spending planner</h1>
          <p>Plan farm costs, record what you spend, and compare your activity with your own budget.</p>
        </div>
      </header>

      <div className="loan-planner-safety" role="note">
        <span className="material-symbols-outlined">verified_user</span>
        <div><strong>You stay in control</strong><p>This planner does not approve loans, assess default risk, restrict spending, or move money. Use it as a record-keeping aid and check your lender&apos;s agreement for official terms.</p></div>
      </div>

      {storageError && <div className="loan-planner-error" role="alert">{storageError}{storageError.startsWith('Saved loan data') && <button type="button" onClick={handleResetLocalData}>Reset local data</button>}</div>}
      {notice && <div className="farmer-workspace-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button></div>}

      <section className="loan-planner-model" aria-labelledby="loan-model-status">
        <span className="material-symbols-outlined">info</span>
        <div><strong id="loan-model-status">Model suggestions are not active</strong><p>The provided notebook describes models trained on synthetic records. The model file and its input/output schema have not been made available to this app, so this page does not present model predictions as advice. Monthly guides below are simple divisions of your own budget, not AI forecasts.</p></div>
        <span className="loan-model-badge">Pending validation</span>
      </section>

      <section className="loan-planner-content">
        <div className="loan-planner-section-heading"><div><span>START HERE</span><h2>Add a loan plan</h2><p>Enter the amount and choose how much you want to plan for each farm category. Unallocated funds remain yours to plan later.</p></div></div>
        <form className="loan-planner-form" onSubmit={handleCreateLoan}>
          <div className="loan-planner-fields">
            <label>Loan purpose<input required maxLength={100} value={loanDraft.purpose} onChange={(event) => setLoanDraft((current) => ({ ...current, purpose: event.target.value }))} placeholder="e.g. 2026 planting season" /></label>
            <label>Lender (optional)<input maxLength={100} value={loanDraft.lender} onChange={(event) => setLoanDraft((current) => ({ ...current, lender: event.target.value }))} placeholder="Bank, cooperative, or programme" /></label>
            <label>Loan amount (TZS)<input required type="number" min="1" step="1" value={loanDraft.principal} onChange={(event) => setLoanDraft((current) => ({ ...current, principal: event.target.value }))} placeholder="500000" /></label>
            <label>Planning term<input required type="number" min="1" max="60" step="1" value={loanDraft.termMonths} onChange={(event) => setLoanDraft((current) => ({ ...current, termMonths: event.target.value }))} /></label>
            <label>Plan start date<input required type="date" value={loanDraft.startDate} onChange={(event) => setLoanDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
          </div>
          <fieldset className="loan-category-fieldset">
            <legend>Optional category budgets (TZS)</legend>
            <div className="loan-category-inputs">{categories.map((category) => (
              <label key={category.id}><span className="material-symbols-outlined">{category.icon}</span><span>{category.label}</span><input aria-label={`${category.label} budget`} type="number" min="0" step="1" value={allocationDraft[category.id]} onChange={(event) => setAllocationDraft((current) => ({ ...current, [category.id]: event.target.value }))} /></label>
            ))}</div>
          </fieldset>
          <button type="submit" className="farmer-workspace-submit"><span className="material-symbols-outlined">add</span>Save loan plan</button>
        </form>
      </section>

      {data.loans.length > 0 && (
        <section className="loan-planner-content">
          <div className="loan-planner-section-heading loan-planner-list-heading"><div><span>YOUR RECORDS</span><h2>Loan plans</h2></div>
            <label className="loan-select-label">Selected plan<select aria-label="Select loan plan" value={activeLoan?.id || ''} onChange={(event) => setActiveLoanId(event.target.value)}>{data.loans.map((loan) => <option key={loan.id} value={loan.id}>{loan.purpose || 'Farm loan'} · {formatTzs(loan.principal)}</option>)}</select></label>
          </div>
          {activeLoan && (
            <>
              <div className="loan-plan-overview">
                <article><span>Loan amount</span><strong>{formatTzs(activeLoan.principal)}</strong><small>{activeLoan.lender || 'Lender not entered'}</small></article>
                <article><span>Planned categories</span><strong>{formatTzs(totalAllocated)}</strong><small>{formatTzs(Math.max(0, Number(activeLoan.principal) - totalAllocated))} not yet allocated</small></article>
                <article><span>Recorded spending</span><strong>{formatTzs(totalSpent)}</strong><small>{loanExpenses.length} expense{loanExpenses.length === 1 ? '' : 's'} recorded</small></article>
              </div>

              <div className="loan-planner-category-heading"><h3>Category plan and spending</h3><p>Monthly guides divide your own category budget evenly across the term. They are illustrative only.</p></div>
              <form className="loan-budget-edit" onSubmit={handleSaveAllocation}>
                <fieldset className="loan-category-fieldset">
                  <legend>Adjust this plan&apos;s category budgets (TZS)</legend>
                  <div className="loan-category-inputs">{categories.map((category) => (
                    <label key={category.id}><span className="material-symbols-outlined">{category.icon}</span><span>{category.label}</span><input aria-label={`Planned ${category.label} budget`} type="number" min="0" step="1" value={editAllocationDraft[category.id]} onChange={(event) => setEditAllocationDraft((current) => ({ ...current, [category.id]: event.target.value }))} /></label>
                  ))}</div>
                </fieldset>
                <button className="farmer-workspace-submit" type="submit"><span className="material-symbols-outlined">save</span>Update category plan</button>
              </form>
              <div className="loan-category-cards">{categories.map((category) => {
                const allocated = Number(activeLoan.allocations?.[category.id] || 0);
                const spent = expensesByCategory[category.id] || 0;
                const monthlyGuide = allocated / Math.max(1, Number(activeLoan.termMonths) || 1);
                const progress = allocated ? Math.min(100, (spent / allocated) * 100) : 0;
                return <article className="loan-category-card" key={category.id}>
                  <div className="loan-category-card-title"><span className="material-symbols-outlined">{category.icon}</span><strong>{category.label}</strong></div>
                  <div className="loan-category-card-values"><span>Plan <strong>{formatTzs(allocated)}</strong></span><span>Spent <strong>{formatTzs(spent)}</strong></span></div>
                  <div className="loan-spending-track" role="progressbar" aria-label={`${category.label} planned budget recorded`} aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>
                  <small>{formatTzs(monthlyGuide)} monthly guide · {spent > allocated ? `${formatTzs(spent - allocated)} over your plan` : `${formatTzs(allocated - spent)} remaining`}</small>
                </article>;
              })}</div>

              <div className="loan-planner-columns">
                <section className="loan-planner-subsection">
                  <h3>Monthly spending guide</h3>
                  <p>Compare your recorded expenses with an even monthly pacing of the budget you set.</p>
                  <div className="loan-schedule-wrap"><table className="loan-schedule-table"><thead><tr><th>Month</th><th>Your guide</th><th>Recorded</th><th>Difference</th></tr></thead><tbody>
                    {schedule.map((entry) => <tr key={entry.key}><th scope="row">{entry.label}</th><td>{formatTzs(entry.planned)}</td><td>{formatTzs(entry.actual)}</td><td className={entry.actual > entry.planned ? 'loan-spend-over' : ''}>{formatTzs(entry.planned - entry.actual)}</td></tr>)}
                  </tbody></table></div>
                </section>

                <section className="loan-planner-subsection">
                  <h3>Record an expense</h3>
                  <p>Record spending for your own tracking. Entries do not connect to a wallet or payment service.</p>
                  <form className="loan-expense-form" onSubmit={handleLogExpense}>
                    <label>Category<select value={expenseDraft.category} onChange={(event) => setExpenseDraft((current) => ({ ...current, category: event.target.value }))}>{categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
                    <label>Amount (TZS)<input required type="number" min="1" step="1" value={expenseDraft.amount} onChange={(event) => setExpenseDraft((current) => ({ ...current, amount: event.target.value }))} /></label>
                    <label>Date<input required type="date" value={expenseDraft.date} onChange={(event) => setExpenseDraft((current) => ({ ...current, date: event.target.value }))} /></label>
                    <label>Note (optional)<input maxLength={160} value={expenseDraft.note} onChange={(event) => setExpenseDraft((current) => ({ ...current, note: event.target.value }))} placeholder="What was purchased?" /></label>
                    <button className="farmer-workspace-submit" type="submit"><span className="material-symbols-outlined">add</span>Record expense</button>
                  </form>
                </section>
              </div>

              <section className="loan-planner-subsection loan-expense-history">
                <div className="loan-planner-section-heading"><div><span>ACTUALS</span><h3>Recent expenses</h3></div><span className="farmer-workspace-count">{loanExpenses.length}</span></div>
                {loanExpenses.length ? <div className="loan-expense-list">{loanExpenses.slice(0, 12).map((entry) => {
                  const category = categories.find((item) => item.id === entry.category);
                  return <article key={entry.id}><span className="material-symbols-outlined">{category?.icon || 'receipt_long'}</span><div><strong>{category?.label || 'Farm expense'}</strong><small>{entry.date}{entry.note ? ` · ${entry.note}` : ''}</small></div><strong>{formatTzs(entry.amount)}<button type="button" aria-label={`Delete ${category?.label || 'expense'} record`} onClick={() => updateData((data) => ({ ...data, expenses: data.expenses.filter((record) => record.id !== entry.id) }))}><span className="material-symbols-outlined">delete</span></button></strong></article>;
                })}</div> : <p className="loan-planner-empty">Your expense records will appear here.</p>}
              </section>

              <section className="loan-training-panel">
                <div><span className="material-symbols-outlined">volunteer_activism</span><div><h3>Optional aggregate export for offline review</h3><p>Nothing is uploaded automatically. If you opt in, you can download a CSV of this plan&apos;s monthly category totals. It excludes your account ID, loan purpose, lender, and notes, but spending amounts and dates can still be sensitive. This export is not training-ready, is not sent to AGRI-NEST, and does not train a model.</p></div></div>
                <label className="loan-training-consent"><input type="checkbox" checked={activeLoan.trainingOptIn === true} onChange={(event) => updateData((currentData) => ({ ...currentData, loans: currentData.loans.map((loan) => loan.id === activeLoan.id ? { ...loan, trainingOptIn: event.target.checked } : loan) }))} />I voluntarily agree to prepare and download this plan&apos;s aggregate spending totals for offline review. I understand the amounts may still be sensitive. I can withdraw consent for future exports at any time; downloaded files remain on my device.</label>
                <div className="loan-training-actions"><button type="button" disabled={activeLoan.trainingOptIn !== true || loanExpenses.length === 0} onClick={handleDownloadFeedback}>Download my aggregate CSV</button><button type="button" className="loan-plan-delete" onClick={handleDeleteLoan}>Delete this loan plan</button></div>
                <small className="loan-training-status">Model status: not connected; no self-training or automated spending decisions are running.</small>
              </section>
            </>
          )}
        </section>
      )}

      {data.loans.length === 0 && (
        <section className="loan-planner-empty-state"><span className="material-symbols-outlined">savings</span><h2>No loan plans yet</h2><p>Add a plan above to see your own category budgets, monthly guide, and expense history.</p></section>
      )}

      <footer className="loan-planner-footer"><span>Saved in this browser for this AGRI-NEST account; this page does not sync loan records between devices. Don&apos;t enter passwords, account numbers, or other sensitive identifiers.</span><button type="button" onClick={handleResetLocalData} disabled={!data.loans.length && !data.expenses.length}>Delete all my local loan-planner data</button></footer>
    </main>
  );
}
