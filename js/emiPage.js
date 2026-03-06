import { fetchEMI, fetchAccounts, fetchMonthlyExpenses, submitEMI, updateEMI, deleteEMI } from './sheetFetcher.js';
import { calculateEMI, renderEMICards } from './emi.js';
import { getAccountBalances } from './dashboard.js';
import { getMonthSheetName } from './config.js';
import { initAuth } from './auth.js';

let currentEMIData = [];

async function loadEMIPage() {
  const container = document.getElementById('emiCards');
  if (container) container.innerHTML = '<div class="loading">Loading EMI data...</div>';

  try {
    const [emiData, accounts, transactions] = await Promise.all([
      fetchEMI(),
      fetchAccounts(),
      fetchMonthlyExpenses(getMonthSheetName())
    ]);
    currentEMIData = emiData;
    const balances = getAccountBalances(accounts, transactions);
    const calculated = calculateEMI(emiData);
    renderEMICards('emiCards', calculated, balances);
    loadAccountOptions(accounts);
  } catch (err) {
    if (container) container.innerHTML = '<div class="loading">Failed to load EMI data.</div>';
  }
}

function loadAccountOptions(accounts) {
  const selects = [document.getElementById('emiAccount'), document.getElementById('editEmiAccount')];
  selects.forEach(select => {
    if (!select) return;
    const currentVal = select.value;
    while (select.options.length > 1) select.remove(1);
    accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.account;
      opt.textContent = acc.account;
      select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
  });
}

function initEMIForm() {
  const toggleBtn = document.getElementById('toggleEmiForm');
  const form = document.getElementById('emiForm');

  toggleBtn.addEventListener('click', () => {
    form.classList.toggle('hidden');
    toggleBtn.classList.toggle('active');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('emiSubmitBtn');
    const statusEl = document.getElementById('emiStatus');

    const emiData = {
      name: document.getElementById('emiName').value.trim(),
      loanAmount: document.getElementById('emiLoanAmount').value,
      emi: document.getElementById('emiAmount').value,
      startDate: document.getElementById('emiStartDate').value,
      tenureMonths: document.getElementById('emiTenure').value,
      deductionDay: document.getElementById('emiDeductionDay').value,
      account: document.getElementById('emiAccount').value
    };

    if (!emiData.name || !emiData.loanAmount || !emiData.emi || !emiData.startDate || !emiData.tenureMonths) {
      statusEl.textContent = 'Please fill all required fields';
      statusEl.className = 'submit-status error';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Adding...';

    try {
      await submitEMI(emiData);
      statusEl.textContent = 'EMI added successfully!';
      statusEl.className = 'submit-status success';
      form.reset();
      form.classList.add('hidden');
      toggleBtn.classList.remove('active');
      setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'submit-status'; }, 2000);
      await loadEMIPage();
    } catch (err) {
      statusEl.textContent = err.message || 'Failed to add EMI';
      statusEl.className = 'submit-status error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add EMI';
    }
  });
}

function initDeleteHandlers() {
  document.getElementById('emiCards').addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;

    const idx = parseInt(btn.dataset.index);
    if (!confirm('Delete this EMI entry?')) return;

    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
      await deleteEMI(idx);
      await loadEMIPage();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Delete';
    }
  });
}

function initEditHandlers() {
  const modal = document.getElementById('editEmiModal');
  const form = document.getElementById('editEmiForm');
  const cancelBtn = document.getElementById('editEmiCancel');

  document.getElementById('emiCards').addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-btn');
    if (!btn) return;

    const idx = parseInt(btn.dataset.index);
    const loan = currentEMIData[idx];
    if (!loan) return;

    document.getElementById('editEmiIndex').value = idx;
    document.getElementById('editEmiName').value = loan.name;
    document.getElementById('editEmiLoanAmount').value = loan.loanAmount;
    document.getElementById('editEmiAmount').value = loan.emi;
    document.getElementById('editEmiStartDate').value = loan.startDate;
    document.getElementById('editEmiTenure').value = loan.tenureMonths;
    document.getElementById('editEmiDeductionDay').value = loan.deductionDay || '';
    document.getElementById('editEmiAccount').value = loan.account || '';
    modal.classList.remove('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('editEmiSave');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const data = {
      rowIndex: parseInt(document.getElementById('editEmiIndex').value),
      name: document.getElementById('editEmiName').value.trim(),
      loanAmount: document.getElementById('editEmiLoanAmount').value,
      emi: document.getElementById('editEmiAmount').value,
      startDate: document.getElementById('editEmiStartDate').value,
      tenureMonths: document.getElementById('editEmiTenure').value,
      deductionDay: document.getElementById('editEmiDeductionDay').value,
      account: document.getElementById('editEmiAccount').value
    };

    try {
      await updateEMI(data);
      modal.classList.add('hidden');
      await loadEMIPage();
    } catch (err) {
      alert('Failed to update: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });
}

function initRefreshButton() {
  const btn = document.getElementById('refreshBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.classList.add('spinning');
    await loadEMIPage();
    btn.classList.remove('spinning');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth(() => {
    initEMIForm();
    initDeleteHandlers();
    initEditHandlers();
    initRefreshButton();
    loadEMIPage();
  });
});
