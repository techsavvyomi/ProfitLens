import { fetchEMI, submitEMI, deleteEMI } from './sheetFetcher.js';
import { calculateEMI, renderEMICards } from './emi.js';
import { initAuth } from './auth.js';

async function loadEMIPage() {
  const container = document.getElementById('emiCards');
  if (container) container.innerHTML = '<div class="loading">Loading EMI data...</div>';

  try {
    const emiData = await fetchEMI();
    const calculated = calculateEMI(emiData);
    renderEMICards('emiCards', calculated);
  } catch (err) {
    if (container) container.innerHTML = '<div class="loading">Failed to load EMI data.</div>';
  }
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
      tenureMonths: document.getElementById('emiTenure').value
    };

    if (!emiData.name || !emiData.loanAmount || !emiData.emi || !emiData.startDate || !emiData.tenureMonths) {
      statusEl.textContent = 'Please fill all fields';
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

document.addEventListener('DOMContentLoaded', () => {
  initAuth(() => {
    initEMIForm();
    initDeleteHandlers();
    loadEMIPage();
  });
});
