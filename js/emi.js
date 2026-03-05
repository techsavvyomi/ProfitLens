import { formatCurrency } from './config.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function calculateEMI(emiData) {
  const now = new Date();

  return emiData.map(loan => {
    const start = new Date(loan.startDate);
    const monthsPassed = Math.max(0,
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth())
    );
    const effectiveMonthsPaid = Math.min(monthsPassed, loan.tenureMonths);
    const amountPaid = loan.emi * effectiveMonthsPaid;
    const remainingAmount = Math.max(0, loan.loanAmount - amountPaid);
    const progressPercent = Math.min(100, (effectiveMonthsPaid / loan.tenureMonths) * 100);

    return {
      ...loan,
      monthsPassed,
      effectiveMonthsPaid,
      amountPaid,
      remainingAmount,
      progressPercent: Math.round(progressPercent)
    };
  });
}

function renderEMICards(containerId, emiList) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (emiList.length === 0) {
    container.innerHTML = '<div class="loading">No EMI data found.</div>';
    return;
  }

  container.innerHTML = emiList.map((loan, i) => `
    <div class="emi-card">
      <div class="card-header-row">
        <h3>${escapeHtml(loan.name)}</h3>
        <button class="delete-btn" data-index="${i}">Delete</button>
      </div>
      <div class="emi-detail">
        <span class="label">Loan Amount</span>
        <span class="value">${formatCurrency(loan.loanAmount)}</span>
      </div>
      <div class="emi-detail">
        <span class="label">Monthly EMI</span>
        <span class="value">${formatCurrency(loan.emi)}</span>
      </div>
      <div class="emi-detail">
        <span class="label">Months Paid</span>
        <span class="value">${loan.effectiveMonthsPaid} / ${loan.tenureMonths}</span>
      </div>
      <div class="emi-detail">
        <span class="label">Amount Paid</span>
        <span class="value">${formatCurrency(loan.amountPaid)}</span>
      </div>
      <div class="emi-detail">
        <span class="label">Remaining</span>
        <span class="value">${formatCurrency(loan.remainingAmount)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${loan.progressPercent}%"></div>
      </div>
      <div class="progress-label">${loan.progressPercent}% completed</div>
    </div>
  `).join('');
}

export { calculateEMI, renderEMICards };
