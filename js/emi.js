import { formatCurrency } from './config.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function ordinalSuffix(day) {
  const n = parseInt(day);
  if (n >= 11 && n <= 13) return n + 'th';
  switch (n % 10) {
    case 1: return n + 'st';
    case 2: return n + 'nd';
    case 3: return n + 'rd';
    default: return n + 'th';
  }
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
    const remainingMonths = loan.tenureMonths - effectiveMonthsPaid;
    const totalPayable = loan.emi * loan.tenureMonths;
    const amountPaid = loan.emi * effectiveMonthsPaid;
    const remainingAmount = loan.emi * remainingMonths;
    const progressPercent = Math.min(100, (effectiveMonthsPaid / loan.tenureMonths) * 100);

    // Check if EMI deduction is upcoming (within 2 days)
    let daysUntilDeduction = null;
    let isUpcoming = false;
    if (loan.deductionDay) {
      const day = parseInt(loan.deductionDay);
      const todayDate = now.getDate();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const effectiveDay = Math.min(day, lastDayOfMonth);

      // Calculate days until deduction
      if (effectiveDay >= todayDate) {
        daysUntilDeduction = effectiveDay - todayDate;
      } else {
        // Next month
        const nextLastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
        const nextEffectiveDay = Math.min(day, nextLastDay);
        daysUntilDeduction = (lastDayOfMonth - todayDate) + nextEffectiveDay;
      }
      isUpcoming = daysUntilDeduction <= 2 && daysUntilDeduction >= 0;
    }

    return {
      ...loan,
      monthsPassed,
      effectiveMonthsPaid,
      remainingMonths,
      totalPayable,
      amountPaid,
      remainingAmount,
      progressPercent: Math.round(progressPercent),
      daysUntilDeduction,
      isUpcoming
    };
  });
}

function renderEMICards(containerId, emiList, accountBalances) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (emiList.length === 0) {
    container.innerHTML = '<div class="loading">No EMI data found.</div>';
    return;
  }

  container.innerHTML = emiList.map((loan, i) => {
    const accountBalance = loan.account && accountBalances && loan.account in accountBalances
      ? accountBalances[loan.account]
      : null;

    const upcomingHtml = loan.isUpcoming
      ? `<div class="emi-reminder">
           EMI due ${loan.daysUntilDeduction === 0 ? 'today' : loan.daysUntilDeduction === 1 ? 'tomorrow' : 'in 2 days'}!
           ${accountBalance !== null ? ` Balance: ${formatCurrency(accountBalance)}` : ''}
         </div>`
      : '';

    return `
    <div class="emi-card${loan.isUpcoming ? ' emi-card-upcoming' : ''}">
      ${upcomingHtml}
      <div class="card-header-row">
        <h3>${escapeHtml(loan.name)}</h3>
        <div class="card-actions">
          <button class="edit-btn" data-index="${i}">Edit</button>
          <button class="delete-btn" data-index="${i}">Delete</button>
        </div>
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
        <span class="label">Total Payable</span>
        <span class="value">${formatCurrency(loan.totalPayable)}</span>
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
      ${loan.deductionDay ? `
      <div class="emi-detail">
        <span class="label">Deduction Date</span>
        <span class="value">${ordinalSuffix(loan.deductionDay)} of every month</span>
      </div>` : ''}
      ${loan.account ? `
      <div class="emi-detail">
        <span class="label">Debit Account</span>
        <span class="value">${escapeHtml(loan.account)}${accountBalance !== null ? ` (${formatCurrency(accountBalance)})` : ''}</span>
      </div>` : ''}
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${loan.progressPercent}%"></div>
      </div>
      <div class="progress-label">${loan.progressPercent}% completed</div>
    </div>
  `}).join('');
}

export { calculateEMI, renderEMICards };
