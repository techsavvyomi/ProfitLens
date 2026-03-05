import { fetchSIP, submitSIP, deleteSIP } from './sheetFetcher.js';
import { calculateSIP, renderSIPCards } from './investments.js';
import { initAuth } from './auth.js';

async function loadInvestmentsPage() {
  const container = document.getElementById('sipCards');
  if (container) container.innerHTML = '<div class="loading">Loading SIP data...</div>';

  try {
    const sipData = await fetchSIP();
    const calculated = calculateSIP(sipData);
    renderSIPCards('sipCards', calculated);
  } catch (err) {
    if (container) container.innerHTML = '<div class="loading">Failed to load SIP data.</div>';
  }
}

function initSIPForm() {
  const toggleBtn = document.getElementById('toggleSipForm');
  const form = document.getElementById('sipForm');

  toggleBtn.addEventListener('click', () => {
    form.classList.toggle('hidden');
    toggleBtn.classList.toggle('active');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('sipSubmitBtn');
    const statusEl = document.getElementById('sipStatus');

    const sipData = {
      fund: document.getElementById('sipFund').value.trim(),
      monthlyAmount: document.getElementById('sipAmount').value,
      startDate: document.getElementById('sipStartDate').value
    };

    if (!sipData.fund || !sipData.monthlyAmount || !sipData.startDate) {
      statusEl.textContent = 'Please fill all fields';
      statusEl.className = 'submit-status error';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Adding...';

    try {
      await submitSIP(sipData);
      statusEl.textContent = 'SIP added successfully!';
      statusEl.className = 'submit-status success';
      form.reset();
      form.classList.add('hidden');
      toggleBtn.classList.remove('active');
      setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'submit-status'; }, 2000);
      await loadInvestmentsPage();
    } catch (err) {
      statusEl.textContent = err.message || 'Failed to add SIP';
      statusEl.className = 'submit-status error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add SIP';
    }
  });
}

function initDeleteHandlers() {
  document.getElementById('sipCards').addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;

    const idx = parseInt(btn.dataset.index);
    if (!confirm('Delete this SIP entry?')) return;

    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
      await deleteSIP(idx);
      await loadInvestmentsPage();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Delete';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth(() => {
    initSIPForm();
    initDeleteHandlers();
    loadInvestmentsPage();
  });
});
