import { CONFIG, getMonthSheetName, getPreviousMonthSheetName, getRecentMonths, formatCurrency, getTodayFormatted } from './config.js';
import { fetchMonthlyExpenses, fetchAccounts, submitExpense, updateExpense, deleteExpenseEntry, submitTransfer, forceSyncAll } from './sheetFetcher.js';
import { getTotalExpenses, getCategoryTotals, getMonthlySummary, getAccountBalances } from './dashboard.js';
import { renderPieChart, renderLineChart, renderBarChart } from './charts.js';
import { generateInsights, renderInsights } from './insights.js';
import { initAuth } from './auth.js';

let selectedCategory = '';
let selectedType = 'Expense';
let currentSheetName = '';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const DEFAULT_EXPENSE_CHIPS = ['Food', 'Bike', 'Home', 'EMI', 'Savings', 'Investment', 'CreditCard', 'Utilities', 'Shopping', 'Other'];
const DEFAULT_INCOME_CHIPS = ['Salary', 'Freelance', 'Investment', 'Other'];

// -- Custom Chips (localStorage) --

function getCustomChips(type) {
  const key = type === 'Income' ? 'custom_income_chips' : 'custom_expense_chips';
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : [];
}

function saveCustomChips(type, chips) {
  const key = type === 'Income' ? 'custom_income_chips' : 'custom_expense_chips';
  localStorage.setItem(key, JSON.stringify(chips));
}

function renderChips(containerId, defaults, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const custom = getCustomChips(type);
  const all = [...defaults, ...custom];

  container.innerHTML = '';
  all.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.dataset.category = cat;
    btn.textContent = cat;

    // Long-press to delete custom chips
    if (custom.includes(cat)) {
      btn.classList.add('custom-chip');
    }

    btn.addEventListener('click', () => {
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCategory = cat;
    });

    container.appendChild(btn);
  });

  // Add "+" button
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'chip chip-add';
  addBtn.textContent = '+';
  addBtn.title = 'Add custom category';
  addBtn.addEventListener('click', () => {
    const name = prompt('Enter new category name:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (all.includes(trimmed)) {
      alert('Category already exists');
      return;
    }
    const updated = [...custom, trimmed];
    saveCustomChips(type, updated);
    renderChips(containerId, defaults, type);
  });
  container.appendChild(addBtn);

  // Add manage button if custom chips exist
  if (custom.length > 0) {
    const manageBtn = document.createElement('button');
    manageBtn.type = 'button';
    manageBtn.className = 'chip chip-manage';
    manageBtn.textContent = 'Manage';
    manageBtn.addEventListener('click', () => {
      const toRemove = prompt('Enter category name to remove:\n\nCustom: ' + custom.join(', '));
      if (!toRemove || !toRemove.trim()) return;
      const filtered = custom.filter(c => c.toLowerCase() !== toRemove.trim().toLowerCase());
      if (filtered.length === custom.length) {
        alert('Category not found in custom list');
        return;
      }
      saveCustomChips(type, filtered);
      renderChips(containerId, defaults, type);
      selectedCategory = '';
    });
    container.appendChild(manageBtn);
  }
}

function initChips() {
  renderChips('categoryChips', DEFAULT_EXPENSE_CHIPS, 'Expense');
  renderChips('incomeChips', DEFAULT_INCOME_CHIPS, 'Income');
}

// -- Dark Mode --

function initThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  toggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
  });
}

// -- Type Toggle --

function initTypeToggle() {
  const btns = document.querySelectorAll('.type-btn');
  const typeInput = document.getElementById('typeSelect');
  const submitBtn = document.getElementById('submitBtn');
  const expenseChips = document.getElementById('categoryChips');
  const incomeChips = document.getElementById('incomeChips');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.dataset.type;
      typeInput.value = selectedType;

      submitBtn.textContent = selectedType === 'Income' ? 'Add Income' : 'Add Expense';

      if (selectedType === 'Income') {
        expenseChips.classList.add('hidden');
        incomeChips.classList.remove('hidden');
      } else {
        expenseChips.classList.remove('hidden');
        incomeChips.classList.add('hidden');
      }

      selectedCategory = '';
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    });
  });
}

// -- Expense Entry Form --

function initExpenseForm() {
  const dateEl = document.getElementById('entryDate');
  if (dateEl) dateEl.textContent = getTodayFormatted();

  loadAccountOptions();

  const form = document.getElementById('expenseForm');
  if (form) {
    form.addEventListener('submit', handleExpenseSubmit);
  }
}

async function loadAccountOptions() {
  const selects = [document.getElementById('accountSelect'), document.getElementById('editAccount')];

  try {
    const accounts = await fetchAccounts();
    selects.forEach(select => {
      if (!select) return;
      // Keep only the default option
      while (select.options.length > 1) select.remove(1);
      accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.account;
        opt.textContent = acc.account;
        select.appendChild(opt);
      });
    });
  } catch (err) {
    console.warn('Could not load accounts:', err.message);
  }
}

function initTransferForm() {
  const toggleBtn = document.getElementById('toggleTransferForm');
  const form = document.getElementById('transferForm');
  if (!toggleBtn || !form) return;

  toggleBtn.addEventListener('click', () => {
    form.classList.toggle('hidden');
    toggleBtn.classList.toggle('active');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('transferSubmitBtn');
    const statusEl = document.getElementById('transferStatus');

    const fromAccount = document.getElementById('transferFrom').value;
    const toAccount = document.getElementById('transferTo').value;
    const amount = document.getElementById('transferAmount').value;
    const notes = document.getElementById('transferNotes').value;

    if (!fromAccount || !toAccount || !amount) {
      statusEl.textContent = 'Please fill all required fields';
      statusEl.className = 'submit-status error';
      return;
    }

    if (fromAccount === toAccount) {
      statusEl.textContent = 'From and To accounts must be different';
      statusEl.className = 'submit-status error';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Transferring...';

    try {
      await submitTransfer({ fromAccount, toAccount, amount, notes });
      statusEl.textContent = 'Transfer recorded!';
      statusEl.className = 'submit-status success';
      form.reset();
      form.classList.add('hidden');
      toggleBtn.classList.remove('active');
      setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'submit-status'; }, 2000);
      setTimeout(() => loadDashboard(), 1000);
    } catch (err) {
      statusEl.textContent = err.message || 'Transfer failed';
      statusEl.className = 'submit-status error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Transfer';
    }
  });
}

async function loadTransferAccountOptions() {
  try {
    const accounts = await fetchAccounts();
    const selects = [document.getElementById('transferFrom'), document.getElementById('transferTo')];
    selects.forEach(select => {
      if (!select) return;
      while (select.options.length > 1) select.remove(1);
      accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.account;
        opt.textContent = acc.account;
        select.appendChild(opt);
      });
    });
  } catch (err) {
    console.warn('Could not load transfer accounts:', err.message);
  }
}

async function handleExpenseSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const amount = document.getElementById('amountInput').value;

  if (!amount || !selectedCategory) {
    showStatus('Please enter amount and select a category', 'error');
    return;
  }

  const expense = {
    date: getTodayFormatted(),
    category: selectedCategory,
    subCategory: document.getElementById('subCategoryInput').value || '',
    account: document.getElementById('accountSelect').value || '',
    amount: amount,
    type: selectedType,
    notes: document.getElementById('notesInput').value || ''
  };

  submitBtn.disabled = true;
  const origText = submitBtn.textContent;
  submitBtn.textContent = 'Adding...';

  try {
    await submitExpense(expense);
    showStatus(`${selectedType} added successfully!`, 'success');
    resetForm();
    setTimeout(() => loadDashboard(), 2000);
  } catch (err) {
    showStatus(err.message || 'Failed to add entry.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('submitStatus');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = 'submit-status ' + type;
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'submit-status';
  }, 3000);
}

function resetForm() {
  document.getElementById('amountInput').value = '';
  document.getElementById('subCategoryInput').value = '';
  document.getElementById('notesInput').value = '';
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  selectedCategory = '';
}

// -- Month Selector --

function initMonthSelector() {
  const select = document.getElementById('monthSelect');
  if (!select) return;

  const months = getRecentMonths(12);
  const current = getMonthSheetName();

  [...months].reverse().forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    if (m === current) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => loadDashboard(select.value));
}

// -- Transactions with Edit/Delete --

function renderTransactions(transactions, sheetName) {
  const tbody = document.getElementById('transactionsBody');
  if (!tbody) return;

  const sorted = [...transactions].sort((a, b) => {
    const parseDate = d => {
      const parts = d.split('/');
      if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
      return new Date(d);
    };
    return parseDate(b.date) - parseDate(a.date);
  });

  const recent = sorted.slice(0, 20);

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">No transactions yet</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(t => {
    const isIncome = t.type.toLowerCase() === 'income';
    return `
    <tr>
      <td>${escapeHtml(t.date)}</td>
      <td><span class="tx-badge ${isIncome ? 'tx-income' : 'tx-expense'}">${escapeHtml(t.category)}</span></td>
      <td class="${isIncome ? 'amount-green' : ''}">${isIncome ? '+' : ''}${formatCurrency(t.amount)}</td>
      <td>${escapeHtml(t.notes || t.subCategory || '-')}</td>
      <td class="tx-actions">
        <button class="tx-edit-btn" data-row="${t.rowIndex}" data-sheet="${escapeHtml(sheetName)}"
          data-date="${escapeHtml(t.date)}" data-category="${escapeHtml(t.category)}" data-amount="${t.amount}"
          data-type="${escapeHtml(t.type)}" data-notes="${escapeHtml(t.notes)}" data-account="${escapeHtml(t.account)}"
          data-subcategory="${escapeHtml(t.subCategory)}">Edit</button>
        <button class="tx-del-btn" data-row="${t.rowIndex}" data-sheet="${escapeHtml(sheetName)}">Del</button>
      </td>
    </tr>
  `}).join('');
}

function initTransactionActions() {
  const tbody = document.getElementById('transactionsBody');
  const modal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  const cancelBtn = document.getElementById('editCancel');

  // Event delegation for edit/delete buttons
  tbody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.tx-edit-btn');
    const delBtn = e.target.closest('.tx-del-btn');

    if (editBtn) {
      // Open edit modal pre-filled
      document.getElementById('editRowIndex').value = editBtn.dataset.row;
      document.getElementById('editSheet').value = editBtn.dataset.sheet;
      document.getElementById('editDate').value = editBtn.dataset.date;
      document.getElementById('editCategory').value = editBtn.dataset.category;
      document.getElementById('editAmount').value = editBtn.dataset.amount;
      document.getElementById('editType').value = editBtn.dataset.type;
      document.getElementById('editNotes').value = editBtn.dataset.notes;
      document.getElementById('editAccount').value = editBtn.dataset.account;
      modal.classList.remove('hidden');
    }

    if (delBtn) {
      if (!confirm('Delete this transaction?')) return;
      delBtn.disabled = true;
      delBtn.textContent = '...';
      try {
        await deleteExpenseEntry(delBtn.dataset.sheet, parseInt(delBtn.dataset.row));
        await loadDashboard(delBtn.dataset.sheet);
      } catch (err) {
        alert('Failed to delete: ' + err.message);
        delBtn.disabled = false;
        delBtn.textContent = 'Del';
      }
    }
  });

  // Cancel modal
  cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Close modal on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  // Save edit
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('editSave');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const data = {
      sheet: document.getElementById('editSheet').value,
      rowIndex: parseInt(document.getElementById('editRowIndex').value),
      date: document.getElementById('editDate').value,
      category: document.getElementById('editCategory').value,
      amount: document.getElementById('editAmount').value,
      type: document.getElementById('editType').value,
      notes: document.getElementById('editNotes').value,
      account: document.getElementById('editAccount').value,
      subCategory: ''
    };

    try {
      await updateExpense(data);
      modal.classList.add('hidden');
      await loadDashboard(data.sheet);
    } catch (err) {
      alert('Failed to update: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });
}

// -- Account Balances --

function renderAccountBalances(balances) {
  const container = document.getElementById('accountBalances');
  if (!container) return;

  const entries = Object.entries(balances);
  if (entries.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:12px">No accounts found</div>';
    return;
  }

  const total = entries.reduce((sum, [, bal]) => sum + bal, 0);

  const totalEl = document.getElementById('totalBalance');
  if (totalEl) totalEl.textContent = formatCurrency(total);

  container.innerHTML = entries.map(([name, bal]) => `
    <div class="account-item">
      <span class="account-name">${escapeHtml(name)}</span>
      <span class="account-balance ${bal < 0 ? 'negative' : ''}">${formatCurrency(bal)}</span>
    </div>
  `).join('');
}

// -- Dashboard Loader --

async function loadDashboard(monthName) {
  currentSheetName = monthName || getMonthSheetName();
  const prevMonth = getPreviousMonthSheetName(
    (() => {
      const parts = currentSheetName.split('-');
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const monthIndex = monthNames.indexOf(parts[0]);
      return new Date(parseInt(parts[1]), monthIndex, 1);
    })()
  );

  const [transactions, prevTransactions, accounts] = await Promise.all([
    fetchMonthlyExpenses(currentSheetName),
    fetchMonthlyExpenses(prevMonth),
    fetchAccounts()
  ]);

  const summary = getMonthlySummary(transactions);
  const categoryTotals = getCategoryTotals(transactions);
  const prevCategoryTotals = getCategoryTotals(prevTransactions);
  const balances = getAccountBalances(accounts, transactions);

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatCurrency(val);
  };
  setEl('totalExpense', summary.totalExpense);
  setEl('totalIncome', summary.totalIncome);
  setEl('totalEMI', summary.totalEMI);
  setEl('totalInvestment', summary.totalInvestment);

  renderPieChart('pieChart', categoryTotals);
  renderBarChart('barChart', categoryTotals, prevCategoryTotals);
  renderAccountBalances(balances);

  const recentMonths = getRecentMonths(6);
  const monthlyTrend = [];
  for (const m of recentMonths) {
    if (m === currentSheetName) {
      monthlyTrend.push({ month: m, total: summary.totalExpense });
    } else if (m === prevMonth) {
      monthlyTrend.push({ month: m, total: getTotalExpenses(prevTransactions) });
    } else {
      const data = await fetchMonthlyExpenses(m);
      monthlyTrend.push({ month: m, total: getTotalExpenses(data) });
    }
  }
  renderLineChart('lineChart', monthlyTrend);

  const insights = generateInsights(categoryTotals, prevCategoryTotals, summary);
  renderInsights('insightsList', insights);

  renderTransactions(transactions, currentSheetName);
}

// -- Refresh Button --

function initRefreshButton() {
  const btn = document.getElementById('refreshBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.classList.add('spinning');
    const select = document.getElementById('monthSelect');
    const month = select ? select.value : getMonthSheetName();
    await forceSyncAll(month);
    await loadDashboard(month);
    btn.classList.remove('spinning');
  });
}

// -- CSV Download --

function initCSVDownload() {
  const btn = document.getElementById('csvDownloadBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const select = document.getElementById('monthSelect');
    const month = select ? select.value : getMonthSheetName();
    btn.disabled = true;
    try {
      const transactions = await fetchMonthlyExpenses(month);
      if (transactions.length === 0) {
        alert('No data to download for ' + month);
        return;
      }
      const headers = ['Date', 'Category', 'SubCategory', 'Account', 'Amount', 'Type', 'Notes'];
      const rows = transactions.map(t =>
        [t.date, t.category, t.subCategory, t.account, t.amount, t.type, t.notes]
          .map(v => '"' + String(v).replace(/"/g, '""') + '"')
          .join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ProfitLens_${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

// -- Init --

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();

  initAuth(() => {
    initChips();
    initTypeToggle();
    initExpenseForm();
    initMonthSelector();
    initTransactionActions();
    initTransferForm();
    loadTransferAccountOptions();
    initRefreshButton();
    initCSVDownload();
    loadDashboard();

    // Auto-refresh every 5 minutes (Firebase is primary, no need for aggressive polling)
    setInterval(() => {
      const select = document.getElementById('monthSelect');
      loadDashboard(select ? select.value : undefined);
    }, 5 * 60 * 1000);
  });
});
