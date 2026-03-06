import { getMonthSheetName, getTodayFormatted, formatCurrency } from './config.js';
import { fetchEMI, fetchAccounts, fetchMonthlyExpenses, submitExpense } from './sheetFetcher.js';
import { getAccountBalances } from './dashboard.js';

// Check which EMIs should be auto-added as expenses this month
// and generate notification alerts for upcoming EMIs / low balances

async function processEMIs(currentSheetName, { autoAdd = true } = {}) {
  const [emiData, accounts, transactions] = await Promise.all([
    fetchEMI(),
    fetchAccounts(),
    fetchMonthlyExpenses(currentSheetName)
  ]);

  if (!emiData || emiData.length === 0) return { added: [], notifications: [] };

  const now = new Date();
  const todayDate = now.getDate();
  const balances = getAccountBalances(accounts, transactions);
  const notifications = [];
  const added = [];

  for (const loan of emiData) {
    if (!loan.deductionDay || !loan.emi) continue;

    const deductionDay = parseInt(loan.deductionDay);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const effectiveDay = Math.min(deductionDay, lastDayOfMonth);

    // Check if loan is still active (within tenure)
    const start = new Date(loan.startDate);
    const monthsSinceStart = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (monthsSinceStart >= loan.tenureMonths) continue;

    // Check if EMI expense already exists for this loan this month
    const alreadyExists = transactions.some(t =>
      t.type.toLowerCase() === 'expense' &&
      t.category.toLowerCase() === 'emi' &&
      t.notes && t.notes.toLowerCase().includes(loan.name.toLowerCase()) &&
      Math.abs(t.amount - loan.emi) < 1
    );

    // Auto-add if deduction day has passed and not already recorded
    if (autoAdd && effectiveDay <= todayDate && !alreadyExists) {
      const dd = String(effectiveDay).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();

      try {
        await submitExpense({
          date: `${dd}/${mm}/${yyyy}`,
          category: 'EMI',
          subCategory: loan.name,
          account: loan.account || '',
          amount: loan.emi,
          type: 'Expense',
          notes: `EMI - ${loan.name}`,
          sheet: currentSheetName
        });
        added.push(loan.name);
      } catch (err) {
        console.warn(`Failed to auto-add EMI for ${loan.name}:`, err.message);
      }
    }

    // Notification: upcoming EMI (within 2 days, not yet passed)
    const daysUntil = effectiveDay - todayDate;
    if (daysUntil > 0 && daysUntil <= 2) {
      const accountBalance = loan.account ? (balances[loan.account] || 0) : null;
      notifications.push({
        type: 'upcoming',
        title: `EMI Due ${daysUntil === 1 ? 'Tomorrow' : 'in 2 Days'}`,
        message: `${loan.name}: ${formatCurrency(loan.emi)}` +
          (loan.account ? ` from ${loan.account}` : ''),
        urgent: accountBalance !== null && accountBalance < loan.emi
      });

      // Low balance warning
      if (accountBalance !== null && accountBalance < loan.emi) {
        notifications.push({
          type: 'low_balance',
          title: 'Low Balance Warning',
          message: `${loan.account} has ${formatCurrency(accountBalance)} but ${loan.name} EMI is ${formatCurrency(loan.emi)}`,
          urgent: true
        });
      }
    }

    // Notification: EMI due today
    if (daysUntil === 0 && !alreadyExists) {
      notifications.push({
        type: 'today',
        title: 'EMI Due Today',
        message: `${loan.name}: ${formatCurrency(loan.emi)}` +
          (loan.account ? ` from ${loan.account}` : ''),
        urgent: true
      });
    }
  }

  // Send push notification if permission granted
  if (notifications.length > 0) {
    sendPushNotifications(notifications);
  }

  return { added, notifications };
}

function sendPushNotifications(notifications) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const urgent = notifications.filter(n => n.urgent);
  const items = urgent.length > 0 ? urgent : notifications.slice(0, 1);

  items.forEach(n => {
    new Notification(n.title, {
      body: n.message,
      icon: 'icons/icon.svg',
      badge: 'icons/icon.svg',
      tag: `emi-${n.type}-${n.title}`,
      renotify: false
    });
  });
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function renderNotificationBanner(containerId, notifications) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!notifications || notifications.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = notifications.map(n => {
    const icon = n.type === 'low_balance' ? '!' : n.type === 'today' ? '!' : '\u25CB';
    const urgentClass = n.urgent ? 'notification-urgent' : 'notification-info';
    return `<div class="notification-item ${urgentClass}">
      <span class="notification-icon">${icon}</span>
      <div class="notification-text">
        <strong>${n.title}</strong>
        <span>${n.message}</span>
      </div>
    </div>`;
  }).join('');
}

export { processEMIs, requestNotificationPermission, renderNotificationBanner };
