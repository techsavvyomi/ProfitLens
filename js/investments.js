import { formatCurrency } from './config.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function calculateSIP(sipData) {
  const now = new Date();

  return sipData.map(sip => {
    const start = new Date(sip.startDate);
    const monthsRunning = Math.max(0,
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth())
    );
    const totalInvested = sip.monthlyAmount * monthsRunning;

    return {
      ...sip,
      monthsRunning,
      totalInvested
    };
  });
}

function renderSIPCards(containerId, sipList) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (sipList.length === 0) {
    container.innerHTML = '<div class="loading">No SIP data found.</div>';
    return;
  }

  container.innerHTML = sipList.map((sip, i) => `
    <div class="sip-card emi-card">
      <div class="card-header-row">
        <h3>${escapeHtml(sip.fund)}</h3>
        <button class="delete-btn" data-index="${i}">Delete</button>
      </div>
      <div class="emi-detail">
        <span class="label">Monthly SIP</span>
        <span class="value">${formatCurrency(sip.monthlyAmount)}</span>
      </div>
      <div class="emi-detail">
        <span class="label">Months Running</span>
        <span class="value">${sip.monthsRunning}</span>
      </div>
      <div class="emi-detail">
        <span class="label">Total Invested</span>
        <span class="value">${formatCurrency(sip.totalInvested)}</span>
      </div>
      <div class="emi-detail">
        <span class="label">Start Date</span>
        <span class="value">${sip.startDate}</span>
      </div>
    </div>
  `).join('');
}

export { calculateSIP, renderSIPCards };
